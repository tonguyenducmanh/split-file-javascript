import Refactor from "./Refactor.js";
import fs from "fs";

let analize = Refactor.analyzeFile("./demo/test.js");
let analizes = Refactor.analyzeFiles("./demo/", "./result/");

const code = fs.readFileSync("sample-split-config.json", "utf8");
let extractConfig = JSON.parse(code);

let splitResult = Refactor.splitFiles(extractConfig);
