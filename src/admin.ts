const canvas = document.getElementById("editor-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const imageInput = document.getElementById("tpl-image") as HTMLInputElement;
const btnClear = document.getElementById("btn-clear") as HTMLButtonElement;
const btnAutoDetect = document.getElementById(
  "btn-autodetect",
) as HTMLButtonElement;
const btnSave = document.getElementById("btn-save") as HTMLButtonElement;
const inputId = document.getElementById("tpl-id") as HTMLInputElement;
const inputName = document.getElementById("tpl-name") as HTMLInputElement;

let uploadedImage = new Image();
let slots: { x: number; y: number; w: number; h: number }[] = [];
let isDrawing = false;
let startX = 0;
let startY = 0;
let mouseX = 0;
let mouseY = 0;

imageInput.addEventListener("change", (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    uploadedImage.onload = () => {
      canvas.width = uploadedImage.width;
      canvas.height = uploadedImage.height;
      canvas.style.display = "block";
      slots = [];
      btnAutoDetect.disabled = false;
      redraw();
    };
    uploadedImage.src = event.target?.result as string;
  };
  reader.readAsDataURL(file);
});

function redraw() {
  if (!uploadedImage.src) return;
  // Draw base image
  ctx.drawImage(uploadedImage, 0, 0);

  // Draw committed slots
  ctx.strokeStyle = "red";
  ctx.lineWidth = 4;
  slots.forEach((s, i) => {
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    // Draw semi-transparent fill
    ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
    ctx.fillRect(s.x, s.y, s.w, s.h);
    // Draw label
    ctx.fillStyle = "red";
    ctx.font = "30px Arial";
    ctx.fillText(`Slot ${i + 1}`, s.x + 10, s.y + 40);
  });

  // Draw current drag
  if (isDrawing) {
    const w = mouseX - startX;
    const h = mouseY - startY;
    ctx.strokeStyle = "blue";
    ctx.strokeRect(startX, startY, w, h);
  }
}

canvas.addEventListener("mousedown", (e) => {
  isDrawing = true;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  startX = (e.clientX - rect.left) * scaleX;
  startY = (e.clientY - rect.top) * scaleY;
  mouseX = startX;
  mouseY = startY;
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  mouseX = (e.clientX - rect.left) * scaleX;
  mouseY = (e.clientY - rect.top) * scaleY;
  redraw();
});

canvas.addEventListener("mouseup", () => {
  if (!isDrawing) return;
  isDrawing = false;

  const w = mouseX - startX;
  const h = mouseY - startY;

  // Normalize bounds (if dragged backwards)
  const x = Math.round(w < 0 ? startX + w : startX);
  const y = Math.round(h < 0 ? startY + h : startY);
  const finalW = Math.round(Math.abs(w));
  const finalH = Math.round(Math.abs(h));

  // Only commit if dimensions are reasonably large
  if (finalW > 10 && finalH > 10) {
    slots.push({ x, y, w: finalW, h: finalH });
  }

  redraw();
});

btnClear.addEventListener("click", () => {
  slots = [];
  redraw();
});

btnAutoDetect.addEventListener("click", () => {
  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const visited = new Uint8Array(width * height);
  const newSlots = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!visited[idx]) {
        visited[idx] = 1;
        const baseIdx = idx * 4;

        // Target: Transparent OR True White
        const isTransparent = data[baseIdx + 3] < 20;
        const isWhite =
          data[baseIdx] > 240 &&
          data[baseIdx + 1] > 240 &&
          data[baseIdx + 2] > 240;

        if (isTransparent || isWhite) {
          let minX = x,
            maxX = x;
          let minY = y,
            maxY = y;
          const queue = [idx];
          let head = 0;

          while (head < queue.length) {
            const curr = queue[head++];
            const cx = curr % width;
            const cy = Math.floor(curr / width);

            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;

            const neighbors = [curr - 1, curr + 1, curr - width, curr + width];
            for (const n of neighbors) {
              if (n >= 0 && n < visited.length && !visited[n]) {
                const nx = n % width;
                if (Math.abs(cx - nx) <= 1) {
                  // Prevent horizontal wrap
                  const nBase = n * 4;
                  const nIsTransparent = data[nBase + 3] < 20;
                  const nIsWhite =
                    data[nBase] > 240 &&
                    data[nBase + 1] > 240 &&
                    data[nBase + 2] > 240;
                  if (nIsTransparent || nIsWhite) {
                    visited[n] = 1;
                    queue.push(n);
                  }
                }
              }
            }
          }

          const slotW = maxX - minX;
          const slotH = maxY - minY;

          // 1. Filter Noise: Ukuran minimal harus 100x100 pixel (abaikan logo/teks kecil)
          const isBigEnough = slotW > 100 && slotH > 100;

          // 2. Filter Outer Background: Abaikan jika kotaknya nyaris sebesar gambar asli (> 95%)
          const isNotEntireCanvas =
            slotW < width * 0.95 || slotH < height * 0.95;

          if (isBigEnough && isNotEntireCanvas) {
            console.log(
              `[AutoDetect] Slot Valid Ditemukan: x=${minX}, y=${minY}, w=${slotW}, h=${slotH}`,
            );
            newSlots.push({ x: minX, y: minY, w: slotW, h: slotH });
          }
        }
      }
    }
  }

  console.log(
    `[AutoDetect] Completed tracing. Detected ${newSlots.length} boxes.`,
  );
  if (newSlots.length === 0) {
    alert(
      "Maaf, tidak mendeteksi slot putih atau transparan apapun pada gambar.",
    );
  }
  slots = newSlots;
  redraw();
});

btnSave.addEventListener("click", async () => {
  if (!uploadedImage.src || slots.length === 0) {
    alert("Please upload an image and draw at least one slot.");
    return;
  }
  if (!inputId.value || !inputName.value) {
    alert("Please provide an ID and Name for the template.");
    return;
  }

  const file = imageInput.files?.[0];
  if (!file) return;

  const config = {
    id: inputId.value,
    name: inputName.value,
    width: canvas.width,
    height: canvas.height,
    slots: slots,
  };

  const formData = new FormData();
  formData.append("image", file);
  formData.append("config", JSON.stringify(config));

  try {
    const response = await fetch("http://localhost:3000/api/templates", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      alert("Success! Template saved to the backend.");
      slots = [];
      inputId.value = "";
      inputName.value = "";
      imageInput.value = "";
      uploadedImage = new Image();
      canvas.style.display = "none";
    } else {
      alert("Failed to save template. Check backend logs.");
    }
  } catch (error) {
    console.error("Save error:", error);
    alert("Network error when saving template.");
  }
});
