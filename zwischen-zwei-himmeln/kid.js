// The boy, drawn on a 400×600 canvas. gesture: two fingers to the temple.
// Used for the swarm at the end (sampled into points) and for the two kids in section IV.
function stroke(ctx, pts, w) {
  ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.stroke();
}
function ellipse(ctx, x0, y0, x1, y1) {
  ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, 0, 0, Math.PI * 2); ctx.fill();
}

export function drawKid(ctx, gesture) {
  ellipse(ctx, 152, 58, 248, 160);                                         // head
  stroke(ctx, [[200, 150], [200, 182]], 36);                               // neck
  ctx.beginPath();                                                         // hoodie body
  [[142, 192], [258, 192], [250, 300], [244, 370], [156, 370], [150, 300]].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath(); ctx.fill();
  stroke(ctx, [[142, 196], [258, 196]], 26);                               // shoulders
  stroke(ctx, [[146, 204], [128, 290], [130, 372]], 30);                   // arm down
  if (gesture) {
    stroke(ctx, [[254, 204], [336, 170], [300, 112]], 28);                 // arm up, elbow out
    ellipse(ctx, 284, 92, 316, 124);                                       // fist, clear of the head
    stroke(ctx, [[288, 100], [254, 96]], 12);                              // index finger to the temple
    stroke(ctx, [[288, 112], [256, 110]], 12);                             // middle finger
    stroke(ctx, [[304, 94], [310, 72]], 11);                               // thumb up
  } else {
    stroke(ctx, [[254, 204], [272, 290], [270, 372]], 30);
  }
  stroke(ctx, [[176, 360], [172, 470], [170, 566]], 42);                   // legs
  stroke(ctx, [[224, 360], [230, 470], [234, 566]], 42);
  ellipse(ctx, 140, 556, 196, 584); ellipse(ctx, 210, 556, 266, 584);      // shoes
}
