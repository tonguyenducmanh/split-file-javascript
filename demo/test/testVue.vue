<template>
  <div class="container">
    <div class="title">{{ $t("i18nCommon.colorPicker.title") }}</div>
    <div class="flex td-color-picker">
      <div v-show="!imageLoaded" class="upload-area-container">
        <TDUpload
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
          @selected="processFile"
          ref="uploadArea"
          class="upload-area"
          maxHeight="100vh"
          :labelEmpty="$t('i18nCommon.colorPicker.uploadLabel')"
          :label="$t('i18nCommon.colorPicker.uploadButton')"
        ></TDUpload>
      </div>
      <div v-if="imageLoaded" class="flex color-picker-container">
        <div class="flex flex-col image-container">
          <div class="flex image-wrapper" ref="imageWrapper">
            <canvas
              ref="canvas"
              @mousemove="handleMouseMove"
              @mouseleave="hideMagnifier"
              @click="selectColor"
              class="main-canvas"
            ></canvas>
            <MagnifyingGlass
              v-if="showMagnifier"
              :x="magnifierX"
              :y="magnifierY"
              :canvas="canvas"
              :mouse-x="mouseX"
              :mouse-y="mouseY"
              :canvasRect="canvasRect"
            />
          </div>
          <div
            v-if="colorPalette && colorPalette.length > 0"
            class="flex palette-info"
          >
            <div>{{ $t("i18nCommon.colorPicker.colorPalette") }}</div>

            <div class="flex palette-grid">
              <div
                v-for="(color, index) in colorPalette"
                :key="index"
                class="palette-color"
                :style="{ backgroundColor: color.hex }"
                @click="handleColorSelected(color)"
                :title="color.hex"
              >
                <div class="color-overlay">
                  <span class="color-hex">{{ color.hex }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="flex flex-col color-info-section">
          <div>{{ $t("i18nCommon.colorPicker.selectedColor") }}</div>
          <template v-if="selectedColor">
            <div>{{ selectedColor.hex }}</div>
            <div
              class="color-preview"
              :style="{ backgroundColor: selectedColor.hex }"
            ></div>
            <TDButton
              v-if="selectedColor"
              ref="copy-btn"
              @click="haddleCopyEvent(selectedColor.hex)"
              :label="$t('i18nCommon.colorPicker.copyColor')"
            ></TDButton>
          </template>
          <TDButton
            :type="$tdEnum.buttonType.secondary"
            @click="resetImage"
            :label="$t('i18nCommon.colorPicker.uploadNewImage')"
            class="btn btn-secondary"
          >
          </TDButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import MagnifyingGlass from "@/components/TDMagnifyingGlass.vue";
import {
  extractImageColors,
  rgbToHex,
  rgbToHsl,
} from "@/common/color/TDColorUtils.js";

export default {
  components: {
    MagnifyingGlass,
  },
  data() {
    return {
      imageLoaded: false,
      canvas: null,
      ctx: null,
      showMagnifier: false,
      magnifierX: 0,
      magnifierY: 0,
      mouseX: 0,
      mouseY: 0,
      selectedColor: null,
      colorPalette: [],
      imageData: null,
      canvasRect: null,
    };
  },
  computed: {
    rgbString() {
      const { r, g, b } = this.selectedColor.rgb;
      return `rgb(${r}, ${g}, ${b})`;
    },
    hslString() {
      const { h, s, l } = this.selectedColor.hsl;
      return `hsl(${h}, ${s}%, ${l}%)`;
    },
  },
  created() {
    let me = this;
    document.addEventListener("paste", me.handlePasteEvent);
  },
  beforeUnmount() {
    let me = this;
    document.removeEventListener("paste", me.handlePasteEvent);
  },
  mounted() {},
  methods: {
    haddleCopyEvent(value) {
      let me = this;
      me.$tdUtility.copyToClipboard(value);
    },
    handleDragOver(e) {
      let me = this;
      e.preventDefault();
      me.isDragOver = true;
    },

    handleDragLeave(e) {
      let me = this;
      e.preventDefault();
      me.isDragOver = false;
    },
    handleDrop(e) {
      e.preventDefault();
      let me = this;
      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.includes("image")
      );

      if (files && files.length > 0) {
        if (
          me.$refs.uploadArea &&
          typeof me.$refs.uploadArea.setFileSelected === "function"
        ) {
          let currentFile = [files[0]];
          me.$refs.uploadArea.setFileSelected(); // chỉ lưu 1 file
          me.processFile(currentFile);
        }
      }
    },
    processFile(files) {
      let me = this;
      let file = files[0];
      if (!file.type.startsWith("image/")) {
        console.error("Please select an image file");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          me.handleImageLoaded(img);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    },
    handleImageLoaded(image) {
      this.imageLoaded = true;
      this.$nextTick(() => {
        this.setupCanvas(image);
        this.generateColorPalette(image);
      });
    },
    handlePasteEvent(e) {
      let me = this;
      e.preventDefault();
      const items = e.clipboardData.items;
      for (let item of items) {
        if (item.type.includes("image")) {
          const blob = item.getAsFile();
          if (
            me.$refs.uploadArea &&
            typeof me.$refs.uploadArea.setFileSelected === "function"
          ) {
            me.$refs.uploadArea.setFileSelected(blob);
            me.processFile([blob]);
          }
          break;
        }
      }
    },
    setupCanvas(image) {
      this.canvas = this.$refs.canvas;
      this.ctx = this.canvas.getContext("2d");

      const wrapper = this.$refs.imageWrapper;
      const containerWidth = wrapper.clientWidth;
      const containerHeight = wrapper.clientHeight;

      const imageWidth = image.width;
      const imageHeight = image.height;
      const imageAspectRatio = imageWidth / imageHeight;

      // Tính scale phù hợp nhất dựa trên cả width và height container
      const widthScale = containerWidth / imageWidth;
      const heightScale = containerHeight / imageHeight;
      const scale = Math.min(widthScale, heightScale, 1); // không phóng to ảnh quá kích thước thật

      // Gán kích thước canvas
      const scaledWidth = imageWidth * scale;
      const scaledHeight = imageHeight * scale;

      this.canvas.width = scaledWidth;
      this.canvas.height = scaledHeight;

      // Vẽ ảnh đã scale vào canvas
      this.ctx.clearRect(0, 0, scaledWidth, scaledHeight);
      this.ctx.drawImage(image, 0, 0, scaledWidth, scaledHeight);

      // Lưu imageData
      this.imageData = this.ctx.getImageData(0, 0, scaledWidth, scaledHeight);
    },

    handleMouseMove(event) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = event.clientX - rect.left;
      this.mouseY = event.clientY - rect.top;

      // Position magnifier
      this.magnifierX = event.clientX;
      this.magnifierY = event.clientY;

      this.showMagnifier = true;
      this.canvasRect = this.$refs.canvas.getBoundingClientRect();
    },

    hideMagnifier() {
      this.showMagnifier = false;
    },

    selectColor(event) {
      if (!this.imageData) return;
      const rect = this.canvas.getBoundingClientRect();

      // Tọa độ chuột tính theo kích thước hiển thị
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Tỷ lệ giữa canvas thật và kích thước hiển thị
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      // Tọa độ thực trên canvas
      const x = Math.floor(mouseX * scaleX);
      const y = Math.floor(mouseY * scaleY);

      const pixelIndex = (y * this.canvas.width + x) * 4;
      const r = this.imageData.data[pixelIndex];
      const g = this.imageData.data[pixelIndex + 1];
      const b = this.imageData.data[pixelIndex + 2];

      this.selectedColor = {
        rgb: { r, g, b },
        hex: rgbToHex(r, g, b),
        hsl: rgbToHsl(r, g, b),
      };
    },

    async generateColorPalette(image) {
      try {
        this.colorPalette = await extractImageColors(image, 7);
      } catch (error) {
        console.error("Error generating color palette:", error);
        this.colorPalette = [];
      }
    },

    handleColorSelected(color) {
      this.selectedColor = color;
    },

    resetImage() {
      this.imageLoaded = false;
      this.canvas = null;
      this.ctx = null;
      this.showMagnifier = false;
      this.selectedColor = null;
      this.colorPalette = [];
      this.imageData = null;
    },
  },
};
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: auto;
}
.td-color-picker {
  display: flex;
  width: 100%;
  height: 95%;
}
.upload-area-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
}
.upload-area {
  width: 70%;
  height: 50%;
}
.color-picker-container {
  width: 100%;
  height: 100%;
}
.image-container {
  position: relative;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.image-wrapper {
  position: relative;
  width: 100%;
  flex: 1;
  overflow: auto;
  align-items: center;
  justify-content: center;
}

.main-canvas {
  width: 100%;
  height: auto;
  border-radius: 12px;
  cursor: crosshair;
  display: block;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
.palette-info {
  height: 100px;
  width: 100%;
  position: relative;
  align-items: center;
}
.color-preview {
  width: 80px;
  height: 80px;
  border-radius: var(--border-radius);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}
.palette-grid {
  height: 100px;
  overflow: auto;
  column-gap: var(--padding);
  margin: var(--padding);
}

.palette-color {
  width: 80px;
  aspect-ratio: 1;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border-color);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.palette-color:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  border-color: var(--border-color);
}

.color-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px;
  transform: translateY(100%);
  transition: transform 0.2s ease;
}
.palette-color:hover .color-overlay {
  transform: translateY(0);
}
.color-hex {
  font-size: 15px;
  text-align: center;
  display: block;
}
</style>
