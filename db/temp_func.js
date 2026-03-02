
function drawLayer_SelectedNet(scaleFactor) {
  if (!selectedNet || selectedNet.length < 2) return

  const vb = getVisibleBounds()
  stroke(0, 255, 255, 200) // Cyan
  strokeWeight(1.5 / scaleFactor)
  noFill()

  // Algorithm: Nearest Neighbor Chain starting from selectedPin (or first pin)
  let current = selectedPin && selectedNet.includes(selectedPin) ? selectedPin : selectedNet[0]
  
  // Clone array to set of unvisited
  const unvisited = new Set(selectedNet)
  unvisited.delete(current)

  const path = [current]
  
  while (unvisited.size > 0) {
    let bestNext = null
    let minD = Infinity
    
    const cx1 = current.center ? current.center[0] : current.x
    const cy1 = current.center ? current.center[1] : current.y
    
    for (const p of unvisited) {
      const cx2 = p.center ? p.center[0] : p.x
      const cy2 = p.center ? p.center[1] : p.y
      
      // Manhattan Distance
      const d = Math.abs(cx1 - cx2) + Math.abs(cy1 - cy2)
      if (d < minD) {
        minD = d
        bestNext = p
      }
    }
    
    if (bestNext) {
      path.push(bestNext)
      unvisited.delete(bestNext)
      current = bestNext
    } else {
      break
    }
  }

  // Draw Lines (Manhattan L-Shapes)
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i]
    const p2 = path[i+1]
    
    const x1 = p1.center ? p1.center[0] : p1.x
    const y1 = p1.center ? p1.center[1] : p1.y
    const x2 = p2.center ? p2.center[0] : p2.x
    const y2 = p2.center ? p2.center[1] : p2.y
    
    beginShape()
    vertex(x1, y1)
    // Midpoint approach for nicer routing? 
    // Or simple L-shape? User asked for "straight vertical and horizontal lines".
    // Simple L-shape is most robust.
    // Try to preserve previous direction if possible? No, too complex.
    // Let's just do Horizontal-Vertical.
    vertex(x2, y1)
    vertex(x2, y2)
    endShape()
    
    // Highlight connected pin
    if (p2 !== selectedPin) {
      const cx = x2
      const cy = y2
      // Reuse logic from drawLayer_Pins for shape size
      const padScale = p2.shape === 'RECT' ? RECT_VISUAL_SCALE : 1
      const isCircleVisual = p2.twoPin || (p2.shape === 'CIRCLE')
      const w = p2.size ? p2.size[0] : p2.w
      const h = p2.size ? p2.size[1] : p2.h
      const d = Math.max((w||0)*padScale, (h||0)*padScale)
      const vw = isCircleVisual ? d : (w||0)*padScale
      const vh = isCircleVisual ? d : (h||0)*padScale
      
      push()
      translate(cx, cy)
      rotate(radians(p2.absRotation || 0))
      noFill()
      stroke(0, 255, 255, 150)
      strokeWeight(1/scaleFactor)
      if (isCircleVisual) circle(0, 0, d)
      else rect(0, 0, vw, vh)
      pop()
    }
  }
  
  // Also highlight the start pin if it's not selectedPin (rare case)
  const p1 = path[0]
  if (p1 !== selectedPin) {
      const cx = p1.center ? p1.center[0] : p1.x
      const cy = p1.center ? p1.center[1] : p1.y
      const padScale = p1.shape === 'RECT' ? RECT_VISUAL_SCALE : 1
      const isCircleVisual = p1.twoPin || (p1.shape === 'CIRCLE')
      const w = p1.size ? p1.size[0] : p1.w
      const h = p1.size ? p1.size[1] : p1.h
      const d = Math.max((w||0)*padScale, (h||0)*padScale)
      const vw = isCircleVisual ? d : (w||0)*padScale
      const vh = isCircleVisual ? d : (h||0)*padScale
      
      push()
      translate(cx, cy)
      rotate(radians(p1.absRotation || 0))
      noFill()
      stroke(0, 255, 255, 150)
      strokeWeight(1/scaleFactor)
      if (isCircleVisual) circle(0, 0, d)
      else rect(0, 0, vw, vh)
      pop()
  }
}
