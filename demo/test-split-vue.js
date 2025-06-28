import Refactor from "../Refactor.js";
import fs from "fs";

console.log("=== DEMO: Split Vue Methods ===");

// Test 1: Phân tích file Vue
console.log("\n1. Phân tích file Vue:");
try {
  const vueAnalysis = Refactor.analyzeVueFile(
    "D:/code/my code/split-file-javascript/demo/test/testVue.vue"
  );
  console.log("✅ Phân tích thành công!");
  console.log(`- Tổng số methods: ${vueAnalysis.totalFunctions}`);
  console.log("- Danh sách methods:");
  vueAnalysis.functionDeclarations.forEach((func) => {
    console.log(`  + ${func.name} (${func.totalLine} dòng)`);
  });
} catch (error) {
  console.error("❌ Lỗi phân tích:", error.message);
}

// Test 2: Tách Vue methods
console.log("\n2. Tách Vue methods:");
try {
  // Đọc config
  const configContent = fs.readFileSync(
    "D:/code/my code/split-file-javascript/demo/sample-vue-split-config.json",
    "utf8"
  );
  const extractConfig = JSON.parse(configContent);

  // Thực hiện tách
  const splitResult = Refactor.splitVueFiles(extractConfig);

  console.log("✅ Tách file thành công!");
  console.log("- Các methods đã tách:");
  splitResult.extractedItems.forEach((item) => {
    console.log(`  + ${item.name} -> ${item.fileName}`);
  });

  if (splitResult.notFound.length > 0) {
    console.log("- Các config không xử lý được:");
    splitResult.notFound.forEach((config) => {
      console.log(`  + ${config.splitedSubName}`);
    });
  }
} catch (error) {
  console.error("❌ Lỗi tách file:", error.message);
}
