import fs from "fs";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";

const refactorConstant = {
  MethodDefinition: "MethodDefinition",
  VariableDeclarator: "VariableDeclarator",
  AssignmentExpression: "AssignmentExpression",
  Property: "Property",
  Anonymous: "Anonymous",
  Unknown: "Unknown",
};

/**
 * file được dùng để xử lý các nghiệp vụ refactor code
 */
class RefactorJS {
  // region declare
  _encodeType = "utf8";
  // end region declare
  // region contructor
  constructor() {}
  // end region contructor

  // region method

  /**
   * phân tích cấu trúc và các method, function có trong 1 file javascript
   * @param {String} filePath đường dẫn file javascript
   */
  analyzeFile(filePath) {
    // đọc toàn bộ source code
    const code = fs.readFileSync(filePath, this._encodeType);

    // đọc ra cấu trúc abstract syntax tree của code javascript
    const ast = this.parseSource(code);

    // khởi tạo object lưu báo cáo về file js
    const analysis = this.initNewAnalysisCode();

    // tạo báo cáo file js
    this.traverseCode(analysis, ast);

    // tính tổng
    analysis.totalFunctions =
      analysis.functionDeclarations.length +
      analysis.functionExpressions.length +
      analysis.arrowFunctions.length;
    analysis.totalClasses = analysis.classDeclarations.length;

    return analysis;
  }

  /**
   * dùng thư viện @babel/traverse để phân tích code
   * @param {Object} analysis đối tượng cần lưu phân tích
   * @param {Object} ast cấu trúc abstract syntax tree của file javascript
   */
  traverseCode(analysis, ast) {
    let me = this;

    let optionTraverse = {
      FunctionDeclaration(nodePath) {
        const node = nodePath.node;
        analysis.functionDeclarations.push({
          name: node.id ? node.id.name : refactorConstant.Anonymous,
          line: node.loc ? node.loc.start.line : refactorConstant.Unknown,
          params: node.params.length,
          async: node.async,
          generator: node.generator,
        });
      },

      FunctionExpression(nodePath) {
        const node = nodePath.node;
        // Skip if it's part of a method definition
        if (
          nodePath.parent.type === refactorConstant.MethodDefinition ||
          nodePath.parent.type === refactorConstant.Property
        ) {
          return;
        }

        analysis.functionExpressions.push({
          name: node.id ? node.id.name : me.getVariableName(nodePath),
          line: node.loc ? node.loc.start.line : refactorConstant.Unknown,
          params: node.params.length,
          async: node.async,
          generator: node.generator,
        });
      },

      ArrowFunctionExpression(nodePath) {
        const node = nodePath.node;
        // Skip if it's part of a method definition
        if (
          nodePath.parent.type === refactorConstant.MethodDefinition ||
          nodePath.parent.type === refactorConstant.Property
        ) {
          return;
        }

        analysis.arrowFunctions.push({
          name: me.getVariableName(nodePath),
          line: node.loc ? node.loc.start.line : refactorConstant.Unknown,
          params: node.params.length,
          async: node.async,
        });
      },

      ClassDeclaration(nodePath) {
        const node = nodePath.node;
        analysis.classDeclarations.push({
          name: node.id ? node.id.name : refactorConstant.Anonymous,
          line: node.loc ? node.loc.start.line : refactorConstant.Unknown,
          superClass: node.superClass ? node.superClass.name : null,
          methods: me.getClassMethods(node),
        });
      },
    };
    traverse.default(ast, optionTraverse);
  }

  /**
   * init default thống kê về các thông tin của 1 file
   * @returns analysis
   */
  initNewAnalysisCode() {
    return {
      // danh sách function dạng khai báo function
      functionDeclarations: [],
      // danh sách function dạng biểu thức
      functionExpressions: [],
      // danh sách function dạng arrow
      arrowFunctions: [],
      // danh sách class dạng khai báo
      classDeclarations: [],
      // tổng số function
      totalFunctions: 0,
      // tổng số class
      totalClasses: 0,
    };
  }

  /**
   * đọc ra cấu trúc abstract syntax tree của code javascript
   * @param {String} code code có trong file js
   * @returns abstract syntax tree
   */
  parseSource(code) {
    const ast = parse(code, {
      sourceType: "module",
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: [
        "jsx",
        "typescript",
        "decorators-legacy",
        "classProperties",
        "objectRestSpread",
        "asyncGenerators",
        "functionBind",
        "exportDefaultFrom",
        "exportNamespaceFrom",
        "dynamicImport",
        "nullishCoalescingOperator",
        "optionalChaining",
      ],
    });
    return ast;
  }

  /**
   * Get the variable name for function expressions and arrow functions
   * @param {Object} nodePath - Babel traverse path
   * @returns {string} Variable name or 'anonymous'
   */
  getVariableName(nodePath) {
    if (
      nodePath.parent.type === refactorConstant.VariableDeclarator &&
      nodePath.parent.id.name
    ) {
      return nodePath.parent.id.name;
    }
    if (
      nodePath.parent.type === refactorConstant.AssignmentExpression &&
      nodePath.parent.left.name
    ) {
      return nodePath.parent.left.name;
    }
    if (
      nodePath.parent.type === refactorConstant.Property &&
      nodePath.parent.key.name
    ) {
      return nodePath.parent.key.name;
    }
    return refactorConstant.Anonymous;
  }

  /**
   * Get method names from a class declaration
   * @param {Object} node - Class declaration node
   * @returns {Array} Array of method names
   */
  getClassMethods(node) {
    return node.body.body
      .filter((member) => member.type === refactorConstant.MethodDefinition)
      .map((method) => ({
        name: method.key.name,
        kind: method.kind, // method, constructor, get, set
        static: method.static,
      }));
  }
  // end region method
}

export default new RefactorJS();
