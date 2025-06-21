import Refactor from "./Refactor.js";

let analize = Refactor.analyzeFile("test.js");

let extractConfig = [
  {
    file: "test.js",
    items: ["Calculator", "MathUtils", "greetUser", "performCalculations"],
    outputDir: "./output/",
    splitedSubName: "test-method-one",
  },
  {
    file: "test.js",
    items: ["calculateSum", "multiplyNumbers"],
    outputDir: "./output/",
    splitedSubName: "test-method-two",
  },
];

let splitResult = Refactor.splitFile("test.js", extractConfig);
debugger;
