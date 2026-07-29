let canvas;
let vw, vh; //viewWidth and viewHeight
let cx, cy; //center of curvature
let angle_c; //angle of curvature of mirror/lens
let R; //radius of curvature
let f; //focal distance
let px; //pole x
let mvector; //mousevector
let mPressed; //mouse pressed

// Camera zoom and pan state variables
let zoomScale = 1.0;
let panX = 0;
let panY = 0;
let worldMouseX = 0;
let worldMouseY = 0;

// Rays Array replacing single static ray variables
let rays = [];

// Override settings
let allowRayOverride = false; // Set to true to bypass the 2-ray limit
let maxRays = 2;              // Default ray limit

// Drag state variables
let draggedRayIndex = -1;
let isDragging = false;
let isPanning = false; // Tracks whether the user is panning the screen
let offsetX = 0;
let offsetY = 0;
let dragMode = ''; 
let allowedToDrag = false; //<- latest commit
let lockTail = false;
let splitSources = false; // Toggles superimposing sources

class ray {
  constructor(x, y, theta, cx, cy, R) {
    this.pos = createVector(x, y);         //starting vector
    this.dir = p5.Vector.fromAngle(theta); //direction vector (unit)
    this.theta = theta;    
    this.cx = cx;
    this.cy = cy;
    this.R = R;
    this.result = calculateIntersection(this.pos.x, this.pos.y, this.theta, this.cx, this.cy, this.R, getSelected());
    if (this.result) {
      this.hx = this.result.hx;
      this.hy = this.result.hy;
      this.mag = dist(this.pos.x, this.pos.y, this.hx, this.hy);
    } else {
      this.hx = this.hy = this.mag = 0;
    }
  }
  
  drawArrow(col = color(255, 200, 0)) {
    push(); // isolate transformations
    strokeWeight(2);
    stroke(col);
    fill(col);

    // Draw line
    line(this.pos.x, this.pos.y,
         this.pos.x + this.dir.x * this.mag,
         this.pos.y + this.dir.y * this.mag);

    // Draw arrowhead
    translate(this.pos.x + this.dir.x * this.mag,
              this.pos.y + this.dir.y * this.mag);
    rotate(this.dir.heading());
    let size = 7;
    triangle(0, 0, -size, size/2-2, -size, -size/2+2);
    pop();
  }

  getX() {  return this.pos.x; }
  getY() {  return this.pos.y; }
  getPhi() {  return -this.theta; }
  hitPoint() {  return createVector(this.hx, this.hy);}
  
  reflect(normalVec) {
    let n = normalVec.copy().normalize();
    let i = this.dir.copy();
    if (i.dot(n) > 0) n.mult(-1);
    let dot = i.dot(n);
    let reflectedDir = p5.Vector.sub(i, p5.Vector.mult(n, 2 * dot));
    
    let r = Object.create(ray.prototype); // skip constructor
    r.pos = createVector(
      this.pos.x + this.dir.x * this.mag,
      this.pos.y + this.dir.y * this.mag
    );
    r.dir = reflectedDir;
    r.mag = 150;
    
    return r;
  }
}

function setup() {
  vw = windowWidth;
  vh = windowHeight;
  canvas = createCanvas(0.8*vw,document.getElementById("canvasParent").clientHeight*0.8); 
  canvas.parent("canvasWrapper");
  canvas.style("border-radius","8px");
  
  R = 100;
  angle_c = PI/2;
  cx = width/2;
  cy = height/2;
  f=R/2;
  px=cx+R;
  
  // Choice update listeners
  document.querySelectorAll('input[name="choice"]').forEach(radio => {
    radio.addEventListener('change', () => {
      updateRaySystem();
    });
  });

  // Bind parameters and configurations using native HTML DOM nodes
  bindHTMLUI();
  
  // Initialize first two rays
  addNewRay();
  addNewRay();
  
  mvector = createVector(mouseX, mouseY);
}

function updateMV() {
  mvector = createVector(mouseX, mouseY);
  // Map raw screen coordinates into transformed world coordinates
  worldMouseX = (mouseX - panX) / zoomScale;
  worldMouseY = (mouseY - panY) / zoomScale;
}

function addNewRay() {
  if (rays.length >= maxRays && !allowRayOverride) {
    return; // Enforce limits unless overridden
  }

  const colorSets = [
    { primary: 'yellow', reflected: 'cyan' },
    { primary: 'orange', reflected: '#ff00ff' }, // Orange and Magenta
    { primary: '#33ff33', reflected: '#ff66ff' }, // Lime Green and Pink
    { primary: '#00ffff', reflected: '#ffaa00' }, // Cyan and Amber
    { primary: '#cc66ff', reflected: '#ffff33' }  // Purple and Bright Yellow
  ];
  
  let activeColor = colorSets[rays.length % colorSets.length];

  let startX = width / 4;
  let startY = cy + 20;

  // If superimpose logic is active, copy coordinates from the primary ray
  if (!splitSources && rays.length > 0) {
    startX = rays[0].x;
    startY = rays[0].y;
  }

  // Offset angle of consecutive rays to make sure they diverge immediately
  let angle = -0.3 + (rays.length * 0.4);

  rays.push({
    x: startX,
    y: startY,
    angle: angle,
    cr: null,
    rr: null,
    normal: null,
    primaryColor: activeColor.primary,
    reflectedColor: activeColor.reflected
  });
  
  updateRaySystem();
  updateAddButtonState();
}

function updateAddButtonState() {
  let btn = document.getElementById("addRayBtn");
  if (btn) {
    if (rays.length >= maxRays && !allowRayOverride) {
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    } else {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.style.cursor = "pointer";
    }
  }
}

function updateRaySystem() {
  for (let r of rays) {
    updateSingleRay(r);
  }
}

function updateSingleRay(r) {
  r.cr = new ray(r.x, r.y, r.angle, cx, cy, R);

  let hit = r.cr.hitPoint();
  let parsed = parseInt(getSelected());
  
  if (r.cr.result) {
    if(parsed === 1) {
      r.normal = createVector(cx - hit.x, cy - hit.y).normalize();
    } else if(parsed === 2) {
      r.normal = createVector(hit.x - (cx+2*R), hit.y - cy).normalize();
    } else if(parsed === 0) {
      r.normal = createVector(-1,0);
    } else {
      r.normal = null;
    }
    
    let hitHeight = abs(hit.y - cy);
    let mirrorMaxHeight = R * sin(angle_c / 2); // Physical half-height of the drawn mirror

    if (parsed <= 2 && parsed >= 0 && hitHeight <= mirrorMaxHeight) {
      r.rr = r.cr.reflect(r.normal);
    } else {
      r.rr = null; // outside mirror boundaries
    }
  } else {
    r.rr = null;
    r.normal = null;
  }
}

// Automatically pans and scales to focus on the ray intersection
function focusOnImage() {
  let targetX = cx;
  let targetY = cy;
  
  if (rays.length === 2 && rays[0].rr && rays[1].rr) {
    let p1 = rays[0].rr.pos;
    let d1 = rays[0].rr.dir;
    let p2 = rays[1].rr.pos;
    let d2 = rays[1].rr.dir;
    
    let intersection = findLineIntersection(p1, d1, p2, d2);
    if (intersection) {
      targetX = intersection.x;
      targetY = intersection.y;
    }
  }
  
  zoomScale = 1.5;
  panX = width / 2 - targetX * zoomScale;
  panY = height / 2 - targetY * zoomScale;
}

// p5.js native scroll zoom handler
function mouseWheel(event) {
  // Verify scroll occurs within the canvas dimensions
  if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
    let zoomFactor = 1.05;
    let prevZoom = zoomScale;
    
    if (event.delta < 0) {
      zoomScale *= zoomFactor;
    } else {
      zoomScale /= zoomFactor;
    }
    
    zoomScale = constrain(zoomScale, 0.2, 5.0);
    
    // Recenter pan so that zooming anchors seamlessly to mouse coordinates
    panX = mouseX - (mouseX - panX) * (zoomScale / prevZoom);
    panY = mouseY - (mouseY - panY) * (zoomScale / prevZoom);
    
    return false; // Prevent standard page scroll
  }
}

// Bind interactive event handling onto existing HTML tags
function bindHTMLUI() {
  const lockCheckbox = document.getElementById("lockTailCheckbox");
  const lockLabel = document.getElementById("anchor-label-id");
  const splitCheckbox = document.getElementById("splitCheckbox");
  const addBtn = document.getElementById("addRayBtn");
  const focusBtn = document.getElementById("focusBtn");
  const resetBtn = document.getElementById("resetBtn");

  if (lockCheckbox && lockLabel) {
    lockCheckbox.addEventListener("change", (e) => {
      lockTail = e.target.checked;
      if (lockTail) {
        animateSuffix(lockLabel, "ed", true);
      } else {
        animateSuffix(lockLabel, "ed", false);
      }
    });
  }

  if (splitCheckbox) {
    splitCheckbox.addEventListener("change", (e) => {
      splitSources = e.target.checked;
      if (!splitSources && rays.length > 0) {
        let first = rays[0];
        for (let i = 1; i < rays.length; i++) {
          rays[i].x = first.x;
          rays[i].y = first.y;
        }
        updateRaySystem();
      }
    });
  }

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      addNewRay();
    });
  }

  if (focusBtn) {
    focusBtn.addEventListener("click", () => {
      focusOnImage();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      panX = 0;
      panY = 0;
      zoomScale = 1.0;
    });
  }

  // Bind parameter input edits
  bindPanelEvents();
  
  const panel = document.getElementById("opticsSidePanel");
const panelToggle = document.getElementById("panelToggle");
const toggleArrow = document.getElementById("toggleArrow");

if (panelToggle && panel) {
  panelToggle.addEventListener("click", () => {
    panel.classList.toggle("collapsed");
    if (toggleArrow) {
      // Toggle arrow direction depending on collapsed status
      toggleArrow.innerText = panel.classList.contains("collapsed") ? "▼" : "▲";
    }
  });
}
  
}

function bindPanelEvents() {
  const uInput = document.getElementById("inputU");
  const rInput = document.getElementById("inputR");
  const fInput = document.getElementById("inputF");
  const hInput = document.getElementById("inputH");
  
  if (uInput) {
    uInput.addEventListener("input", (e) => {
      let val = parseFloat(e.target.value);
      if (!isNaN(val) && rays.length > 0) {
        let P_x = cx + R;
        let newX = P_x + val; // u = x - P_x => x = P_x + u
        rays[0].x = newX;
        if (!splitSources) {
          for (let i = 1; i < rays.length; i++) {
            rays[i].x = newX;
          }
        }
        updateRaySystem();
      }
    });
  }
  
  if (hInput) {
    hInput.addEventListener("input", (e) => {
      let val = parseFloat(e.target.value);
      if (!isNaN(val) && rays.length > 0) {
        let newY = cy - val; // h = cy - y => y = cy - h
        rays[0].y = newY;
        if (!splitSources) {
          for (let i = 1; i < rays.length; i++) {
            rays[i].y = newY;
          }
        }
        updateRaySystem();
      }
    });
  }
  
  if (rInput) {
    rInput.addEventListener("input", (e) => {
      let val = parseFloat(e.target.value);
      if (!isNaN(val) && val !== 0) {
        R = abs(val);
        f = R / 2;
        updateRaySystem();
      }
    });
  }
  
  if (fInput) {
    fInput.addEventListener("input", (e) => {
      let val = parseFloat(e.target.value);
      if (!isNaN(val) && val !== 0) {
        f = abs(val);
        R = f * 2;
        updateRaySystem();
      }
    });
  }
}

// Recalculates sign conventions and synchronizes display fields
function updatePanelReadouts() {
  const uInput = document.getElementById("inputU");
  const vReadout = document.getElementById("readoutV");
  const rInput = document.getElementById("inputR");
  const fInput = document.getElementById("inputF");
  const hInput = document.getElementById("inputH");
  const hPrimeReadout = document.getElementById("readoutHPrime");
  
  if (rays.length === 0) return;
  
  let P_x = cx + R; // Pole coordinate
  let choice = parseInt(getSelected());
  
  // 1) Object distance u (negative to the left of Pole)
  let u_val = rays[0].x - P_x;
  if (uInput && document.activeElement !== uInput) {
    uInput.value = u_val.toFixed(1);
  }
  
  // 2) Object height h (positive above cy)
  let h_val = cy - rays[0].y;
  if (hInput && document.activeElement !== hInput) {
    hInput.value = h_val.toFixed(1);
  }
  
  // 3) Radius R & Focal Length f (sign matches optical structure curvature)
  if (choice === 0) {
    // Plane mirror
    if (rInput && document.activeElement !== rInput) rInput.value = "∞";
    if (fInput && document.activeElement !== fInput) fInput.value = "∞";
  } else if (choice === 1) {
    // Concave mirror (C and F lie on left => negative under sign convention)
    if (rInput && document.activeElement !== rInput) rInput.value = (-R).toFixed(1);
    if (fInput && document.activeElement !== fInput) fInput.value = (-f).toFixed(1);
  } else if (choice === 2) {
    // Convex mirror (C and F lie on right => positive under sign convention)
    if (rInput && document.activeElement !== rInput) rInput.value = R.toFixed(1);
    if (fInput && document.activeElement !== fInput) fInput.value = f.toFixed(1);
  }
  
  // 4) Image distance v and Image height h'
  if (rays.length === 2 && rays[0].rr && rays[1].rr) {
    let p1 = rays[0].rr.pos;
    let d1 = rays[0].rr.dir;
    let p2 = rays[1].rr.pos;
    let d2 = rays[1].rr.dir;
    
    let intersection = findLineIntersection(p1, d1, p2, d2);
    if (intersection) {
      let v_val = intersection.x - P_x; // left of Pole is negative, right is positive
      let hPrime_val = cy - intersection.y; // above axis is positive, below is negative
      
      if (vReadout) vReadout.innerText = v_val.toFixed(1);
      if (hPrimeReadout) hPrimeReadout.innerText = hPrime_val.toFixed(1);
    } else {
      if (vReadout) vReadout.innerText = "N/A (Parallel)";
      if (hPrimeReadout) hPrimeReadout.innerText = "N/A";
    }
  } else {
    if (vReadout) vReadout.innerText = "N/A (No Intersection)";
    if (hPrimeReadout) hPrimeReadout.innerText = "N/A";
  }
}

function draw() {
  background(55,55,75);
  
  // Handles real-time mouse position and ray dragging updates
  updateMV();
  dragRayAround();
  
  // Apply visual pan & zoom matrix transformations
  push();
  translate(panX, panY);
  scale(zoomScale);

  let choice = getSelected();
  if (choice !== null) {
    drawMirror(parseInt(choice));
  }   

  const halfWhite = color(255,255,255,150);

  // Render rays
  for (let r of rays) {
    if (r.cr) {
      r.cr.drawArrow(r.primaryColor || 'yellow');
      
      push();
      fill(r.primaryColor || 'yellow');
      noStroke();
      circle(r.cr.getX(), r.cr.getY(), 7);
      pop();
      
      if (r.normal && r.rr) {
        drawVectorArrow(r.cr.hitPoint(), r.normal, 75, halfWhite);
        r.rr.drawArrow(r.reflectedColor || 'cyan');
      }
    }
  }

  // Calculate and draw image indicator at the intersection of the two reflected rays
  if (rays.length === 2 && rays[0].rr && rays[1].rr) {
    let p1 = rays[0].rr.pos;
    let d1 = rays[0].rr.dir;
    let p2 = rays[1].rr.pos;
    let d2 = rays[1].rr.dir;

    let intersection = findLineIntersection(p1, d1, p2, d2);
    if (intersection) {
      // Draw dashed visual projection lines from mirror hits to the intersection point
      push();
      stroke(255, 255, 255, 120);
      strokeWeight(1.5);
      if (drawingContext.setLineDash) {
        drawingContext.setLineDash([5, 5]);
      }
      line(p1.x, p1.y, intersection.x, intersection.y);
      line(p2.x, p2.y, intersection.x, intersection.y);
      if (drawingContext.setLineDash) {
        drawingContext.setLineDash([]);
      }
      pop();

      // Draw the vertical image indicator arrow
      drawImageIndicator(intersection.x, intersection.y);
    }
  }
  
  pop(); // Exit pan & zoom scope
  
  // Synchronize parameter calculations on panel readouts
  updatePanelReadouts();
}

// Solves for 2D line-line intersection
function findLineIntersection(p1, d1, p2, d2) {
  const dx1 = d1.x;
  const dy1 = d1.y;
  const dx2 = d2.x;
  const dy2 = d2.y;
  
  const denom = dx2 * dy1 - dx1 * dy2;
  if (abs(denom) < 1e-6) {
    return null; // Parallel rays
  }
  
  const dt1 = dx2 * (p2.y - p1.y) - dy2 * (p2.x - p1.x);
  const t1 = dt1 / denom;
  
  return createVector(p1.x + t1 * dx1, p1.y + t1 * dy1);
}

// Draws a vertical indicator arrow from y=cy to the intersection height
function drawImageIndicator(ix, iy) {
  push();
  stroke(255, 100, 100); // Hot neon pink/red for visual clarity
  fill(255, 100, 100);
  strokeWeight(2);
  
  // Line from principal axis to intersection
  line(ix, cy, ix, iy);
  
  // Rotate the arrowhead toward the direction of formation
  let dirY = iy - cy;
  let heading = dirY >= 0 ? HALF_PI : -HALF_PI;
  
  translate(ix, iy);
  rotate(heading);
  let size = 5;
  triangle(0, 0, -size, size/2, -size, -size/2);
  pop();
}

function drawMirror(num) {
  let step = 0.1;
  let steps = Math.floor(angle_c/step);
  let startA = -angle_c/2;
  let endA = angle_c/2;
  let hatching_amount=7;
  let h_steps = angle_c/hatching_amount;
  
  stroke(255);
  strokeWeight(3);
  noFill();
  
  if (num == 0) {
    push(); //draw the plane mirror
    translate(cx, cy);
    beginShape();
      for(let i = 0; i<=steps; i++) {
        let k = startA + i*step;
        vertex(R, R*sin(k));        
        line(R,R*sin(k),R+10,R*sin(k)+7); //hatching
      }
      vertex(R,R*sin(endA));
    endShape();
    pop(); //drawn
  }
  ////// concave M
  else if (num == 1) {
    push(); //draw the curve of the mirror
    translate(cx, cy);
    beginShape();
      for(let i = 0; i<=steps; i++) {
        let k = startA + i*step;        
        vertex(R*cos(k), R*sin(k));
        line(R*cos(k), R*sin(k), R*cos(k)+10, (R-10)*sin(k)); //hatchings
      }
      vertex(R*cos(endA),R*sin(endA));
      line(R*cos(endA), R*sin(endA), R*cos(endA)+10, (R-10)*sin(endA)); //hatchings
    endShape();
    pop(); //drawn
  } 
  else if(num==2) {
    push(); //draw the curve of the mirror
    translate(cx, cy);
    beginShape();
      for(let i = 0; i<=steps; i++) {
        let k = startA + i*step;
        vertex(-R*(cos(k)-2), R*sin(k));    
        line(-R*(cos(k)-2), -R*sin(k), -R*(cos(k)-2)+10, (-R+5)*sin(k)); //hatchings
      }
      vertex(-R*cos(endA)+2*R,R*sin(endA));
      line(-R*(cos(endA)-2), -R*sin(endA), -R*(cos(endA)-2)+10, (-R+5)*sin(endA));
    endShape();
    pop(); //drawn
  }
  
  push();
  strokeWeight(0.2);
  line(-width/2,cy, (3/2)*width, cy);
  pop();
  push();
  stroke('orange');
  point(cx,cy);
  point(cx+R/2,cy);
  point(cx+R,cy);
  point(cx+(3/2)*R,cy);
  point(cx+2*R,cy)
  pop();
}

function getSelected() {
    let selected = document.querySelector('input[name="choice"]:checked');
    if (selected) {
      return selected.value;
    }
    return null;
}

function calculateIntersection(x, y, phi, cx, cy, R, sel) {
  switch(parseInt(sel)) {
    case 0: {
      const vx = cos(phi);
      const vy = sin(phi);
      const mirrorX = cx + R;

      if (abs(vx) < 1e-8) return null; // ray parallel to mirror

      const t = (mirrorX - x) / vx;
      if (t <= 0) return null; // mirror behind ray

      const hx = x + t * vx;
      const hy = y + t * vy;

      return { t, hx, hy };    
    }
    case 1: {
      const vx = cos(phi);
      const vy = sin(phi);
      const dx = x-cx;
      const dy = y-cy;
    
      const a = 1;
      const b = 2*(dx*vx+dy*vy);
      const c = dx*dx + dy*dy - R*R;
      const D = b*b - 4*a*c;
    
      if(D<0) {return null;} //imaginary root
    
      const sqrtD = sqrt(D);
      const t1 = (-b + sqrtD) / (2*a);
      const t2 = (-b - sqrtD) / (2*a);
    
      let t;
      if(t1>0 && t2>0 && x < cx) {
        t = Math.max(t1,t2); // earlier intersection
      } else if (t1 > 0) {
        t = t1;
      } else if (t2 > 0) {
        t = t2;
      } else {
        return null; //invalid hitpoint
      }
    
      const hx = x + t*vx;
      const hy = y + t*vy;
        
      return { t, hx, hy };
    }
    case 2 : {
      const vx = cos(phi);
      const vy = sin(phi);
      const dx = x-(cx+2*R);
      const dy = y-cy;
    
      const a = 1;
      const b = 2*(dx*vx+dy*vy);
      const c = dx*dx + dy*dy - R*R;
      const D = b*b - 4*a*c;
    
      if(D<0) {return null;} //imaginary root
    
      const sqrtD = sqrt(D);
      const t1 = (-b + sqrtD) / (2*a);
      const t2 = (-b - sqrtD) / (2*a);
    
      let t;
      if(t1>0 && t2>0 && x < cx) {
        t = Math.min(t1,t2); // earlier intersection
      } else if (t1 < 0) {
        t = t1;
      } else if (t2 < 0) {
        t = t2;
      } else {
        return null; //invalid hitpoint
      }
    
      const hx = x + t*vx;
      const hy = y + t*vy;
        
      return { t, hx, hy };
    }
    default :
      return null;
  }	
}

// Check if click is close to a ray line segment (mapped to World coordinates)
function isMouseNearRay(r) {
  if (!r || !r.cr) return false;

  let start = r.cr.pos;
  let end;
  
  if (r.cr.result) {
    end = r.cr.hitPoint();
  } else {
    end = p5.Vector.add(start, p5.Vector.mult(r.cr.dir, 150));
  }

  let dx = end.x - start.x;
  let dy = end.y - start.y;
  let lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return false;

  let t = ((worldMouseX - start.x) * dx + (worldMouseY - start.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  let closestX = start.x + t * dx;
  let closestY = start.y + t * dy;

  let distance = dist(worldMouseX, worldMouseY, closestX, closestY);

  // Scaled tolerance so grabbing feels identically responsive at any zoom level
  let tolerance = 15 / zoomScale; 
  return distance < tolerance;
}

// Handles panning and ray transformations mapped to the world coordinates
function dragRayAround() {
  if (mouseIsPressed && allowedToDrag) {
    if (!isDragging && !isPanning) {
      let grabbedAny = false;
      for (let i = 0; i < rays.length; i++) {
        if (isMouseNearRay(rays[i])) {
          isDragging = true;
          draggedRayIndex = i;
          grabbedAny = true;
          
          let r = rays[i];
          if (lockTail) {
            dragMode = "rotate";
          } else {
            dragMode = "translate";
            offsetX = r.x - worldMouseX;
            offsetY = r.y - worldMouseY;
          }
          break; // Stop checking when a match is found
        }
      }
      
      // If the drag didn't occur near any ray, treat it as a background viewport pan
      if (!grabbedAny) {
        isPanning = true;
      }
    }

    if (isDragging && draggedRayIndex !== -1) {
      let r = rays[draggedRayIndex];
      if (dragMode === 'rotate') {
        r.angle = atan2(worldMouseY - r.y, worldMouseX - r.x);
      } else if (dragMode === 'translate') {
        r.x = worldMouseX + offsetX;
        r.y = worldMouseY + offsetY;
        
        // Superimpose the start coordinate of all other rays if splitting is disabled
        if (!splitSources) {
          for (let other of rays) {
            other.x = r.x;
            other.y = r.y;
          }
        }
      }
      updateRaySystem();
    } else if (isPanning) {
      // Direct raw screen translation delta for panning
      panX += mouseX - pmouseX;
      panY += mouseY - pmouseY;
    }
  } else {
    isDragging = false;
    isPanning = false;
    draggedRayIndex = -1;
    dragMode = '';
  }
}

function mousePressed() {
  mPressed = true;
  
  // Only allow dragging or panning if the press begins inside the canvas bounds
  if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
    allowedToDrag = true;
  } else {
    allowedToDrag = false;
  }
}

function mouseReleased() {
  mPressed = false;
  allowedToDrag = false;
}

function drawVectorArrow(origin, vec, len = 50, col = 'white') {
  push();
  stroke(col);
  fill(col);
  strokeWeight(2);

  let v = vec.copy().normalize().mult(len);

  line(origin.x, origin.y, origin.x + v.x, origin.y + v.y);

  translate(origin.x + v.x, origin.y + v.y);
  rotate(v.heading());

  triangle(0, 0, -8, 2, -8, -2);
  pop();
}

function animateSuffix(element, suffix, add = true, speed = 80, cursor = "|") {
    clearInterval(element._typingInterval);

    const full = element.textContent.replace(/\|$/, "");

    let base, current, target;

    if (add) {
        base = full;
        current = "";
        target = suffix;
    } else {
        base = full.slice(0, -suffix.length);
        current = suffix;
        target = "";
    }

    element._typingInterval = setInterval(() => {
        if (add) {
            if (current.length < suffix.length) {
                current += suffix[current.length];
                element.textContent = base + current + cursor;
            } else {
                clearInterval(element._typingInterval);
                element.textContent = base + suffix;
            }
        } else {
            if (current.length > 0) {
                current = current.slice(0, -1);
                element.textContent = base + current + cursor;
            } else {
                clearInterval(element._typingInterval);
                element.textContent = base;
            }
        }
    }, speed);
}
