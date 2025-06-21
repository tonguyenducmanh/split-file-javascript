import Refactor from "./Refactor.js";

let analize = Refactor.analyzeFile("test.js");

let extractConfig = [
  {
    file: "test.js",
    items: [
      "calculateSum",
      "multiplyNumbers",
      "divideNumbers",
      "Calculator",
      "performCalculations",
    ],
    outputDir: "./output/",
    splitedSubName: "test-method-one",
  },
  {
    file: "test.js",
    items: ["greetUser"],
    outputDir: "./output/",
    splitedSubName: "test-method-two",
  },
];

let splitResult = Refactor.splitFile("test.js", extractConfig);
debugger;
