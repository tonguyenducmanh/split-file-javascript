import Refactor from "./Refactor.js";
import fs from "fs";

let analize = Refactor.analyzeFile("test.js");

const code = fs.readFileSync("sample-split-config.json", "utf8");
let extractConfig = JSON.parse(code);

let splitResult = Refactor.splitFile("test.js", extractConfig);
debugger;
