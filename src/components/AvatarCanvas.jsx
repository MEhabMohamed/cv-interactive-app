import React, { useRef, useEffect, useState } from 'react';

/**
 * AvatarCanvas renders the bot/avatar.
 * It animates the bot at 60fps using requestAnimationFrame:
 * 1. If a custom photo is uploaded, it crops and renders it inside a glowing portal.
 * 2. It overlays animated eyes (with random blinking) and an animated mouth (wobbling when speaking).
 * 3. Eye/Mouth sliders allow user calibration over their photo.
 * 4. If no photo is uploaded, it draws a high-fidelity glowing holographic AI robot.
 */
export default function AvatarCanvas({
  photoUrl,
  isSpeaking,
  isPaused,
  eyeY = 40,      // Eye position in % from top (default: 40)
  mouthY = 65,    // Mouth position in % from top (default: 65)
  gender = 'female',
  calibrationMode = false,
  size = 280,     // custom size in px
  hideCalibrationBox = false
}) {
  const canvasRef = useRef(null);
  const [imageElement, setImageElement] = useState(null);
  const requestRef = useRef(null);

  // Load custom image element when photoUrl changes
  useEffect(() => {
    if (!photoUrl) {
      setImageElement(null);
      return;
    }
    const img = new Image();
    img.src = photoUrl;
    img.onload = () => {
      setImageElement(img);
    };
    img.onerror = () => {
      console.error("Failed to load avatar image");
      setImageElement(null);
    };
  }, [photoUrl]);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set internal resolution larger for high-DPI displays
    const size = 560; // 280 * 2
    canvas.width = size;
    canvas.height = size;
    
    // Animation state variables
    let blinkState = 0; // 0 = open, 1 = closing, 2 = closed, 3 = opening
    let blinkProgress = 0;
    let nextBlinkTime = Date.now() + 3000;
    let mouthWobble = 0;

    const render = (time) => {
      // 1. Clear and Draw Background
      ctx.clearRect(0, 0, size, size);
      
      // Draw smooth radial glow background
      const radGlow = ctx.createRadialGradient(size/2, size/2, 50, size/2, size/2, size/2);
      if (gender === 'female') {
        radGlow.addColorStop(0, '#1d152e');
        radGlow.addColorStop(1, '#0b0c10');
      } else {
        radGlow.addColorStop(0, '#101c2e');
        radGlow.addColorStop(1, '#0b0c10');
      }
      ctx.fillStyle = radGlow;
      ctx.fillRect(0, 0, size, size);

      // Handle breathing/bobbing offsets
      const breatheOffset = Math.sin(time / 500) * 6;
      const speakOffset = (isSpeaking && !isPaused) ? Math.sin(time / 80) * 4 : 0;
      const totalYOffset = breatheOffset + speakOffset;

      ctx.save();
      ctx.translate(0, totalYOffset);

      // 2. Render Avatar Base (Photo or default Hologram)
      const radius = size * 0.43; // crop circular bounds
      const centerX = size / 2;
      const centerY = size / 2;

      if (imageElement) {
        // Draw user photo with circular clipping
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.clip();

        // Calculate aspect ratios for cover fit
        const imgAspect = imageElement.width / imageElement.height;
        const drawRadius = radius * 2;
        let dw = drawRadius;
        let dh = drawRadius;
        let dx = centerX - radius;
        let dy = centerY - radius;

        if (imgAspect > 1) {
          dw = drawRadius * imgAspect;
          dx = centerX - dw / 2;
        } else {
          dh = drawRadius / imgAspect;
          dy = centerY - dh / 2;
        }

        ctx.drawImage(imageElement, dx, dy, dw, dh);
        
        // Dark screen vignette overlay on the photo for retro UI feel
        const vignette = ctx.createRadialGradient(centerX, centerY, radius * 0.6, centerX, centerY, radius);
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
        ctx.fillStyle = vignette;
        ctx.fill();
        
        ctx.restore();
      } else {
        // Draw beautiful default AI Robot face
        drawDefaultRobot(ctx, centerX, centerY, radius, time, gender, isSpeaking && !isPaused);
      }

      // 3. Render Face Overlays (Eyes and Mouth)
      // Resolve eye and mouth Y coordinates inside the portal
      const resolvedEyeY = centerY - radius + (radius * 2) * (eyeY / 100);
      const resolvedMouthY = centerY - radius + (radius * 2) * (mouthY / 100);
      
      const themeColor = gender === 'female' ? '#ec4899' : '#3b82f6';
      const secondaryColor = gender === 'female' ? '#a78bfa' : '#60a5fa';

      // Eye Blinking logic
      const now = Date.now();
      if (now > nextBlinkTime && blinkState === 0) {
        blinkState = 1; // start closing
        blinkProgress = 0;
      }

      if (blinkState > 0) {
        blinkProgress += 0.25;
        if (blinkState === 1 && blinkProgress >= 1) {
          blinkState = 2; // closed
          blinkProgress = 0;
        } else if (blinkState === 2 && blinkProgress >= 0.5) {
          blinkState = 3; // opening
          blinkProgress = 0;
        } else if (blinkState === 3 && blinkProgress >= 1) {
          blinkState = 0; // open
          nextBlinkTime = now + 2000 + Math.random() * 4000;
        }
      }

      let eyeHeightMultiplier = 1;
      if (blinkState === 1) eyeHeightMultiplier = 1 - blinkProgress;
      else if (blinkState === 2) eyeHeightMultiplier = 0.05;
      else if (blinkState === 3) eyeHeightMultiplier = blinkProgress;

      // Draw interactive elements on top of the image
      if (imageElement) {
        // Glowing overlay eyes
        drawOverlayEyes(ctx, centerX, resolvedEyeY, radius, eyeHeightMultiplier, themeColor, secondaryColor);
        
        // Glowing overlay mouth
        if (isSpeaking && !isPaused) {
          // Speak wave wobble
          mouthWobble = 0.4 * Math.sin(time / 60) + 0.6 * Math.cos(time / 130);
          // Keep mouth height matching speech rhythm
          const mouthOpenFactor = Math.abs(mouthWobble);
          drawOverlayMouth(ctx, centerX, resolvedMouthY, radius, mouthOpenFactor, themeColor);
        } else {
          // Idle smile line
          drawOverlayMouth(ctx, centerX, resolvedMouthY, radius, 0, themeColor);
        }
      }

      ctx.restore();

      // 4. Calibration Helpers (drawn outside translating context to ensure coordinate precision)
      if (calibrationMode && imageElement) {
        drawCalibrationLines(ctx, size, resolvedEyeY + totalYOffset, resolvedMouthY + totalYOffset);
      }

      // 5. Portal Ring Outline & Glow
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.lineWidth = 6;
      const ringGrad = ctx.createLinearGradient(0, 0, size, size);
      ringGrad.addColorStop(0, '#8a5cf6');
      ringGrad.addColorStop(0.5, themeColor);
      ringGrad.addColorStop(1, '#ec4899');
      ctx.strokeStyle = ringGrad;
      ctx.shadowBlur = 15;
      ctx.shadowColor = themeColor;
      ctx.stroke();
      ctx.shadowBlur = 0; // reset shadow

      // Draw subtle futuristic hud ring outside
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 14, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.stroke();

      if (isSpeaking && !isPaused) {
        // Rotating loading-like indicators in speak mode
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(time / 800);
        ctx.beginPath();
        ctx.arc(0, 0, radius + 14, 0, Math.PI / 4);
        ctx.lineWidth = 3;
        ctx.strokeStyle = themeColor;
        ctx.stroke();
        ctx.restore();
      }

      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(requestRef.current);
    };
  }, [imageElement, isSpeaking, isPaused, eyeY, mouthY, gender, calibrationMode]);

  return (
    <div className="bot-container">
      <div 
        className={`avatar-wrapper ${isSpeaking && !isPaused ? 'speaking' : ''}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <canvas
          ref={canvasRef}
          className={`avatar-canvas ${isSpeaking && !isPaused ? 'speaking' : ''}`}
        />
      </div>
      
      {photoUrl && calibrationMode && !hideCalibrationBox && (
        <div className="calibration-box card-glass">
          <div style={{gridColumn: '1 / -1', textAlign: 'center', fontSize: '0.8rem', color: '#a78bfa', fontWeight: 'bold', marginBottom: '0.25rem'}}>
            PORTRAIT CALIBRATION ACTIVE
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
            <span style={{fontSize: '0.75rem'}}>Eye Height</span>
            <div style={{height: '2px'}}></div>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
            <span style={{fontSize: '0.75rem'}}>Mouth Height</span>
            <div style={{height: '2px'}}></div>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------
// Helper Drawing Functions
// -----------------------------

function drawDefaultRobot(ctx, cx, cy, r, time, gender, speaking) {
  const primary = gender === 'female' ? '#ec4899' : '#3b82f6';
  const accent = '#8a5cf6';
  
  // Robot head shell
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  ctx.fillStyle = '#1e1f29';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.stroke();

  // Face shield plate (dark mirror visor)
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.65, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0f1015';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = accent;
  ctx.stroke();

  // Ear antenna structures
  ctx.fillStyle = accent;
  // Left ear
  ctx.fillRect(cx - r * 0.88, cy - 25, 8, 50);
  ctx.beginPath();
  ctx.arc(cx - r * 0.88 + 4, cy - 35, 6, 0, Math.PI * 2);
  ctx.fill();
  
  // Right ear
  ctx.fillRect(cx + r * 0.88 - 8, cy - 25, 8, 50);
  ctx.beginPath();
  ctx.arc(cx + r * 0.88 - 4, cy - 35, 6, 0, Math.PI * 2);
  ctx.fill();

  // Draw cyber lines on head
  ctx.beginPath();
  ctx.moveTo(cx - 30, cy - r * 0.6);
  ctx.lineTo(cx - 10, cy - r * 0.7);
  ctx.lineTo(cx + 10, cy - r * 0.7);
  ctx.lineTo(cx + 30, cy - r * 0.6);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.stroke();

  // Speaking indicator: subtle glowing sine wave inside visor
  if (speaking) {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy + 10);
    for (let x = -r * 0.5; x <= r * 0.5; x += 5) {
      const yAmp = Math.sin((x + time * 0.5) / 10) * (5 + Math.sin(time / 200) * 8);
      ctx.lineTo(cx + x, cy + yAmp);
    }
    ctx.strokeStyle = primary;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = primary;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function drawOverlayEyes(ctx, cx, eyeY, radius, heightMult, color, secondary) {
  const eyeOffset = radius * 0.3; // eye horizontal separation
  const eyeRadius = 14;

  // Let's draw high-tech glowing digital visor/eyes
  ctx.shadowBlur = 8;
  ctx.shadowColor = color;

  // Left Eye
  ctx.beginPath();
  ctx.ellipse(cx - eyeOffset, eyeY, eyeRadius, eyeRadius * heightMult, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  
  ctx.beginPath();
  ctx.ellipse(cx - eyeOffset, eyeY, eyeRadius - 4, (eyeRadius - 4) * heightMult, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Right Eye
  ctx.beginPath();
  ctx.ellipse(cx + eyeOffset, eyeY, eyeRadius, eyeRadius * heightMult, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  
  ctx.beginPath();
  ctx.ellipse(cx + eyeOffset, eyeY, eyeRadius - 4, (eyeRadius - 4) * heightMult, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  
  // Inner pupils reflecting light
  if (heightMult > 0.3) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - eyeOffset - 3, eyeY - 3, 3, 0, Math.PI * 2);
    ctx.arc(cx + eyeOffset - 3, eyeY - 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
}

function drawOverlayMouth(ctx, cx, mouthY, radius, openFactor, color) {
  ctx.shadowBlur = 12;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.fillStyle = color;

  const mouthWidth = radius * 0.28;
  
  if (openFactor === 0) {
    // Idle smile line
    ctx.beginPath();
    ctx.arc(cx, mouthY - 4, mouthWidth / 2, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  } else {
    // Speaking dynamic mouth capsule (opens vertically)
    const mouthHeight = Math.max(4, 26 * openFactor);
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, mouthWidth / 2, mouthHeight, 0, 0, Math.PI * 2);
    
    // Add custom dark fill, glowing rim
    ctx.fillStyle = 'rgba(15, 17, 26, 0.95)';
    ctx.fill();
    ctx.stroke();

    // Inner teeth bars for premium robotic detail
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(cx - mouthWidth * 0.2, mouthY - mouthHeight * 0.5, mouthWidth * 0.4, 2);
    ctx.fillRect(cx - mouthWidth * 0.2, mouthY + mouthHeight * 0.5 - 2, mouthWidth * 0.4, 2);
    ctx.globalAlpha = 1.0;
  }
  
  ctx.shadowBlur = 0;
}

function drawCalibrationLines(ctx, size, eyeY, mouthY) {
  // Eye line
  ctx.beginPath();
  ctx.setLineDash([5, 5]);
  ctx.moveTo(10, eyeY);
  ctx.lineTo(size - 10, eyeY);
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'; // Blue dash for eyes
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  // Mouth line
  ctx.beginPath();
  ctx.moveTo(10, mouthY);
  ctx.lineTo(size - 10, mouthY);
  ctx.strokeStyle = 'rgba(236, 72, 153, 0.8)'; // Pink dash for mouth
  ctx.stroke();
  ctx.setLineDash([]); // Reset line dash
  
  // Labels
  ctx.fillStyle = '#fff';
  ctx.font = '10px monospace';
  ctx.fillText("EYES ALIGNMENT LINE", 20, eyeY - 4);
  ctx.fillText("MOUTH ALIGNMENT LINE", 20, mouthY - 4);
}
