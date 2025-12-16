document.addEventListener('DOMContentLoaded', () => {
let currentJsonName = "";

(function () {
    const url = window.location.href;
    const lastPart = url.split("/").pop();

    if (lastPart.endsWith(".json")) {
        currentJsonName = decodeURIComponent(
            lastPart.replace(".json", "")
        );
    }
})();


  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
 
  const svgList = document.getElementById("svgList");
  const svgItemTemplate = document.getElementById("svgItemTemplate");
 
  let bgImage = null;
  let svgElements = [];
  let selectedSvgIndex = -1;
  
  // Canvas control variables
  let scale = 1.0;
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let lastX, lastY;
  
  // Image position and size
  let imgX = 0, imgY = 0, imgW = 0, imgH = 0;
  let aspectRatio = 1;
  // Initialize canvas size
  function initCanvas() {
    // Set canvas to full container size
    const container = document.getElementById('canvasContainer');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    draw();
  }

  // Handle window resize
  window.addEventListener('resize', () => {
    const container = document.getElementById('canvasContainer');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    draw();
  });
  // Main drawing function
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    // Draw background image
    if (bgImage) {
      const imgRatio = bgImage.naturalWidth / bgImage.naturalHeight;
      
      if (imgW === 0 || imgH === 0) {
        if (imgRatio > canvas.width / canvas.height) {
          imgW = canvas.width * 0.8; // 80% of canvas width
          imgH = imgW / imgRatio;
        } else {
          imgH = canvas.height * 0.8; // 80% of canvas height
          imgW = imgH * imgRatio;
        }
        imgX = (canvas.width - imgW) / 2;
        imgY = (canvas.height - imgH) / 2;
        aspectRatio = imgRatio;
      }

      ctx.drawImage(bgImage, imgX, imgY, imgW, imgH);
    }
    // Draw all SVGs when none is selected, or draw only the selected one
    svgElements.forEach((svg, index) => {
      if (svg.image && (selectedSvgIndex === -1 || selectedSvgIndex === index)) {
        const svgRatio = svg.image.naturalWidth / svg.image.naturalHeight;
        let drawW, drawH;

        if (svgRatio > canvas.width / canvas.height) {
          drawW = canvas.width * 0.8; // 80% of canvas width
          drawH = drawW / svgRatio;
        } else {
          drawH = canvas.height * 0.8; // 80% of canvas height
          drawW = drawH * svgRatio;
        }

        const svgX = (canvas.width - drawW) / 2;
        const svgY = (canvas.height - drawH) / 2;
        ctx.drawImage(svg.image, svgX, svgY, drawW, drawH);
        // Faixa branca que oculta 30px do topo do SVG


  const jsonPart = currentJsonName ? currentJsonName : "SEMJSON";
const fullTitle = `${jsonPart} - ${svg.name}`;

// ------------------------------
// FAIXA AMARELA MUITO ARREDONDADA
// ------------------------------
ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

const pad = 120;            // margens laterais
const faixaX = svgX + pad;
const faixaW = drawW - pad * 2;
const faixaH = 60;         // altura da faixa

// raio gigante = metade da altura → formato de pílula
const radius = faixaH / 2;

// Desenha faixa muito arredondada
ctx.beginPath();
ctx.moveTo(faixaX + radius, svgY);
ctx.lineTo(faixaX + faixaW - radius, svgY);
ctx.quadraticCurveTo(faixaX + faixaW, svgY, faixaX + faixaW, svgY + radius);
ctx.lineTo(faixaX + faixaW, svgY + faixaH - radius);
ctx.quadraticCurveTo(faixaX + faixaW, svgY + faixaH, faixaX + faixaW - radius, svgY + faixaH);
ctx.lineTo(faixaX + radius, svgY + faixaH);
ctx.quadraticCurveTo(faixaX, svgY + faixaH, faixaX, svgY + faixaH - radius);
ctx.lineTo(faixaX, svgY + radius);
ctx.quadraticCurveTo(faixaX, svgY, faixaX + radius, svgY);
ctx.closePath();

ctx.fillStyle = "#fbff00ff";
ctx.fill();

// ------------------------------
// TEXTO CENTRALIZADO NA FAIXA
// ------------------------------
ctx.font = "bold 30px Arial"; 
ctx.textAlign = "center";
ctx.textBaseline = "middle";

const textX = faixaX + faixaW / 2;
const textY = svgY + faixaH / 2;

// Borda preta
ctx.lineWidth = 4;
ctx.strokeStyle = "#fffb00ff";
ctx.strokeText(fullTitle, textX, textY);

// Texto amarelo
ctx.fillStyle = "#000000ff";
ctx.fillText(fullTitle, textX, textY);

      }
    });
}
  
// Update SVG list in the sidebar
  function updateSvgList() {
    svgList.innerHTML = '';
    
    svgElements.forEach((svg, index) => {
      const item = svgItemTemplate.content.cloneNode(true);
      const li = item.querySelector('li');
      const nameSpan = item.querySelector('.svg-name');
     
      
      nameSpan.textContent = svg.name;
      
      // Add double click handler for renaming
      nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        showNameModal(svg.name, index);
      });
      
      if (index === selectedSvgIndex) {
        li.classList.add('active');
      }
li.addEventListener('click', () => {
        selectSvg(index);
      });
      
     
      
      svgList.appendChild(item);
    });
  }

function selectSvg(index) {
    selectedSvgIndex = index;
    updateSvgList();
    
    const selectionInfo = document.getElementById('selectionInfo');

    if (index >= 0 && index < svgElements.length) {
        selectionInfo.classList.remove('hidden');
        selectionInfo.classList.add('visible');
        draw();

    } else {

        selectionInfo.classList.remove('visible');
        setTimeout(() => {
            selectionInfo.classList.add('hidden');
        }, 300);
        draw();
    }
}



 



  // Zoom and pan controls
  document.getElementById('zoomInBtn').addEventListener('click', () => {
    scale *= 1.2;
    draw();
  });

  document.getElementById('zoomOutBtn').addEventListener('click', () => {
    scale /= 1.2;
    draw();
  });

  document.getElementById('resetZoomBtn').addEventListener('click', () => {
    scale = 1.0;
    offsetX = 0;
    offsetY = 0;
    draw();
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const mouseX = (e.offsetX - offsetX) / scale;
    const mouseY = (e.offsetY - offsetY) / scale;
    
    if (e.deltaY < 0) scale *= zoomFactor;
    else scale /= zoomFactor;
    
    offsetX = e.offsetX - mouseX * scale;
    offsetY = e.offsetY - mouseY * scale;
    draw();
  });

  canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    lastX = e.offsetX;
    lastY = e.offsetY;
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("mouseup", () => {
    isDragging = false;
    canvas.style.cursor = "grab";
  });

  canvas.addEventListener("mousemove", (e) => {
    if (isDragging) {
      const dx = e.offsetX - lastX;
      const dy = e.offsetY - lastY;
      offsetX += dx;
      offsetY += dy;
      lastX = e.offsetX;
      lastY = e.offsetY;
      draw();
    }
  });

// Move the canvas with arrow keys (pan) + zoom with +/-
document.addEventListener("keydown", (e) => {

    const step = e.ctrlKey ? 40 : 10; // velocidade normal = 10px, CTRL = turbo
    const zoomStep = 0.05; // intensidade do zoom
    let changed = false;

    switch (e.key) {

        // ==== PAN (MANTIDO EXATAMENTE COMO VOCÊ QUER) ====
        case "ArrowUp":
            offsetY += step;
            changed = true;
            break;

        case "ArrowDown":
            offsetY -= step;
            changed = true;
            break;

        case "ArrowLeft":
            offsetX += step;
            changed = true;
            break;

        case "ArrowRight":
            offsetX -= step;
            changed = true;
            break;

        // ==== ZOOM (+) ====
        case "+":
        case "=":
            scale += zoomStep;
            changed = true;
            break;

        // ==== ZOOM (-) ====
        case "-":
        case "_":
            scale = Math.max(0.1, scale - zoomStep);
            changed = true;
            break;

        default:
            return; // não redesenha para outras teclas
    }

    if (changed) draw();
});
async function loadJsonUrlSeparate(url) {
  console.log("Carregando URL:", url);

  try {
    // Decodifica automaticamente o parâmetro
    const finalUrl = decodeURIComponent(url);
    console.log("URL final:", finalUrl);

    const response = await fetch(finalUrl, { mode: "cors" })
      .catch(err => {
        console.error("ERRO NO FETCH:", err);
        throw err;
      });

    if (!response || !response.ok) {
      console.error("RESPOSTA RUIM:", response.status, response.statusText);
      return;
    }

    const data = await response.json()
      .catch(err => {
        console.error("ERRO AO PARSEAR JSON:", err);
        throw err;
      });

    console.log("JSON recebido:", data);

    // LIMPA TUDO
    svgElements = [];
    bgImage = null;
    selectedSvgIndex = -1;

    // ===============================
    // CANVAS SETTINGS
    // ===============================
    if (data.canvas) {
      canvas.width = data.canvas.width || canvas.width;
      canvas.height = data.canvas.height || canvas.height;
      scale = 1;
      offsetX = 0;
      offsetY = 0;
    }

    // ===============================
    // BACKGROUND
    // ===============================
    if (data.backgroundImage && data.backgroundImage.imageData) {
      console.log("Carregando imagem de fundo…");

      const img = new Image();
      img.onload = () => {
        bgImage = img;
        imgX = data.backgroundImage.x || 0;
        imgY = data.backgroundImage.y || 0;
        imgW = data.backgroundImage.width || img.naturalWidth;
        imgH = data.backgroundImage.height || img.naturalHeight;
        aspectRatio = img.naturalWidth / img.naturalHeight;
        draw();
      };
      img.src = data.backgroundImage.imageData;
    }

    // ===============================
    // SVG ELEMENTS
    // ===============================
    if (Array.isArray(data.svgElements)) {
      console.log("Carregando SVGs…");

      const promises = data.svgElements.map(svgData => new Promise(resolve => {
        const svgBlob = new Blob([svgData.code], { type: "image/svg+xml" });
        const tempUrl = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
          svgElements.push({
            name: svgData.name,
            code: svgData.code,
            image: img
          });
          URL.revokeObjectURL(tempUrl);
          resolve();
        };
        img.src = tempUrl;
      }));

      await Promise.all(promises);
    }

    updateSvgList();
    if (svgElements.length > 0) selectSvg(0);

    draw();

    console.log("✔ JSON carregado e renderizado com sucesso!");

  } catch (err) {
    console.error("ERRO FINAL:", err);
  }
}
const params = new URLSearchParams(window.location.search);
const fileParam = params.get("file");

if (fileParam) {
  console.log("Detectado parâmetro ?file= ->", fileParam);
  loadJsonUrlSeparate(fileParam);
} else {
  console.log("Nenhum parâmetro ?file= encontrado.");
}

  // Initialize the app
  initCanvas();
});