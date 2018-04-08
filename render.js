module.exports = render

var bresenham = require('bresenham')
var termsize = require('window-size')
var polygon = require('./polygon')
// var vscreen = require('./screen')

function render (charm, camera, elements, allElements) {
  // var screen = vscreen(termsize.width, termsize.height)
  elements.forEach(renderElement.bind(null, charm, camera, allElements))
  drawStatusBar(charm, camera)
  // return screen.data()
}

function renderElement (screen, camera, allElements, element) {
  switch (element.type) {
    case 'node': renderNode(screen, camera, allElements, element); break
    case 'way': renderWay(screen, camera, allElements, element); break
    // default: console.log('unknown', element.type)
  }
}

function nodeToTermCoords (camera, node) {
  var horizScale = 1//0.55
  var vertScale = 1

  var w = camera.bbox[1][1] - camera.bbox[1][0]
  var h = camera.bbox[0][1] - camera.bbox[0][0]
  var x = Math.round(((node.lon - camera.bbox[1][0]) / w) * termsize.width * horizScale)
  var y = termsize.height - Math.round(((node.lat - camera.bbox[0][0]) / h) * termsize.height * vertScale)
  return [x, y]
}

function renderNode (screen, camera, allElements, node) {
  if (!node.tags) return

  if (node.tags.noexit) return

  var label = getName(node)

  var pos = nodeToTermCoords(camera, node)
  var x = pos[0]
  var y = pos[1]
  if (x < 0 || y < 0 || x >= termsize.width || y >= termsize.height) return

  screen.position(x, y)
  screen.foreground(color(node))
  screen.write('o')
  if (label) {
    var lx = x - label.length / 2
    var ly = y - 1
    if (lx < 0) lx = 0
    screen.position(lx, ly)
    screen.write(label)
  // } else {
  //   console.log(node.tags)
  }
}

function renderWay (screen, camera, allElements, way) {
  if (!way.tags) return
  if (way.tags.area === 'yes') return  // for now

  screen.display('bright')
  var chr = null
  var col = null
  var area = false
  screen.foreground('white')
  if (way.tags.highway) {
    var hw = way.tags.highway
    if (hw === 'track') {
      if (way.tags.tracktype === 'grade4') { col = 'white'; chr = '&' }
      else if (way.tags.tracktype === 'grade3') { col = 'white'; chr = '%' }
      else if (way.tags.tracktype === 'grade2') { col = 'white'; chr = '*' }
      else if (way.tags.tracktype === 'grade1') { col = 'white'; chr = '.' }
    }
    else if (hw === 'residential')    { col = 'black'; chr = '.' }
    else if (hw === 'living_street')  { col = 'black'; chr = '.' }
    else if (hw === 'service')        { col = 'cyan'; chr = '.' }
    else { col = 'white'; chr = '.' }
  }
  if (way.tags.barrier)                    { col = 'black'; chr = 'x' }
  if (way.tags.leisure)                    { col = 'green'; chr = '.'; area = true }
  if (way.tags.building)                   { col = 'black'; chr = '#'; area = true }
  if (way.tags.landuse === 'orchard')      { col = 'green'; chr = '^'; area = true }
  else if (way.tags.landuse === 'retail')       { col = 'black'; chr = '$'; area = true }
  else if (way.tags.landuse === 'residential')  { col = 'green'; chr = '.'; area = true }
  else if (way.tags.landuse === 'residential')  { col = 'green'; chr = '.'; area = true }
  else if (way.tags.landuse)                    { col = 'green'; chr = '^'; area = true }
  if (way.tags.amenity === 'university')   { col = 'magenta'; chr = '.'; area = true }
  if (way.tags.natural)                    { col = 'green'; chr = '~' }
  if (!col) { col = color(way); chr = '?' }
  screen.foreground(col)

  if (area) {
    // draw as polygon
    var centroid = [0,0]
    var pts = []
    for (var i=0; i < way.refs.length; i++) {
      var n = allElements[way.refs[i]]
      if (!n) continue
      var p = nodeToTermCoords(camera, n)
      pts.push(p)
      centroid[0] += p[0]
      centroid[1] += p[1]
    }
    polygon(screen, pts, chr)

    var label = getName(way)
    if (label) {
      screen.foreground('white')
      centroid[0] /= way.refs.length
      centroid[1] /= way.refs.length
      screen.position(centroid[0] - label.length/3, centroid[1])
      screen.write(label)
    }
  } else {
    // draw as line
    for (var i=0; i < way.refs.length - 1; i++) {
      var n1 = allElements[way.refs[i]]
      var n2 = allElements[way.refs[i+1]]
      if (!n1 || !n2) continue
      var p1 = nodeToTermCoords(camera, n1)
      var p2 = nodeToTermCoords(camera, n2)
      var pts = bresenham(p1[0], p1[1], p2[0], p2[1])
      for (var j=0; j < pts.length; j++) {
        var x = pts[j].x
        var y = pts[j].y
        if (x < 0 || y < 0 || x >= termsize.width || y >= termsize.height) continue
        screen.position(x, y)
        screen.write(chr)
      }
    }
  }
}

function color (elm) {
  var colours = [
    'red',
    'yellow',
    'green',
    'blue',
    'cyan',
    'magenta',
    // 'black',
    'white'
  ]
  n = Number(parseInt(elm.id, 16)) % colours.length
  return colours[n]
}

function drawStatusBar (screen, camera) {
  screen.position(0, termsize.height - 1)
  for (var i = 0; i < termsize.width; i++) {
    screen.write('=')
  }
  screen.position(0, termsize.height - 0)
  for (var i = 0; i < termsize.width; i++) {
    screen.write(' ')
  }

  screen.position(termsize.width - 25, termsize.height - 0)
  var lat = ((camera.bbox[0][1] + camera.bbox[0][0]) / 2).toFixed(6)
  var lon = ((camera.bbox[1][1] + camera.bbox[1][0]) / 2).toFixed(6)
  screen.write(lat + ' ' + lon)
}

function getName (elm) {
  var label
  if (elm.tags.name) label = elm.tags.name
  else if (elm.tags.amenity) label = elm.tags.amenity
  else if (elm.tags.highway) label = elm.tags.highway
  return label
}
