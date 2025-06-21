import fs from "fs";
import { parse } from "@babel/parser";
import babelTraverse from "@babel/traverse";
import babelGenerate from "@babel/generator";
import path from "path";
import babelTypes from "@babel/types";

const traverse = babelTraverse.default;
const generate = babelGenerate.default;
/**
 * khai báo constant để không hard code
 */
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
    this.traverseCodeForAnalyze(analysis, ast);

    // tính tổng
    this.caculateTotal(analysis);

    return analysis;
  }

  /**
   * tính tổng
   */
  caculateTotal(analysis) {
    analysis.totalFunctions =
      analysis.functionDeclarations.length +
      analysis.functionExpressions.length +
      analysis.arrowFunctions.length;
    analysis.totalClasses = analysis.classDeclarations.length;
  }

  /**
   * dùng thư viện @babel/traverse để phân tích code
   * @param {Object} analysis đối tượng cần lưu phân tích
   * @param {Object} ast cấu trúc abstract syntax tree của file javascript
   */
  traverseCodeForAnalyze(analysis, ast) {
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
    traverse(ast, optionTraverse);
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

  splitFile(filePath, extractConfig) {
    let me = this;
    const code = fs.readFileSync(filePath, this._encodeType);
    const ast = this.parseSource(code);
    this.createFolderOutput(extractConfig);

    const extractedItems = [];
    const notFound = [...extractConfig];
    const importsToAdd = [];

    // Dictionary để gom node theo file đích
    const fileNodesMap = new Map();

    this.traverseCodeForSplit(
      ast,
      extractConfig,
      me,
      notFound,
      extractedItems,
      importsToAdd,
      fileNodesMap
    );

    // Ghi từng file 1 lần
    for (const [filePath, items] of fileNodesMap.entries()) {
      const exportNodes = items.map(({ node }) =>
        babelTypes.exportNamedDeclaration(node, [])
      );
      const newAst = babelTypes.program(exportNodes, [], "module");
      const code = generate(newAst).code;
      fs.writeFileSync(filePath, code, this._encodeType);
    }

    this.addImportToSourceFile(importsToAdd, ast);
    const modifiedCode = generate(ast, { comments: true }).code;
    fs.writeFileSync(filePath, modifiedCode, this._encodeType);

    return { extractedItems, notFound };
  }

  addToFile(
    name,
    node,
    currentConfig,
    extractedItems,
    importsToAdd,
    fileNodesMap
  ) {
    const output = this.getOutputConfig(currentConfig);
    const key = path.join(output.outputDir, output.fileName);
    if (!fileNodesMap.has(key)) fileNodesMap.set(key, []);
    fileNodesMap.get(key).push({ node, name });

    const relativePath = this.buildImportPathFile(key);
    extractedItems.push({ name, fileName: output.fileName, path: key });
    importsToAdd.push({ name, path: relativePath });
  }
  createFunctionFromDeclarator(declarator, name) {
    if (babelTypes.isFunctionExpression(declarator.init)) {
      return babelTypes.functionDeclaration(
        babelTypes.identifier(name),
        declarator.init.params,
        declarator.init.body,
        declarator.init.generator,
        declarator.init.async
      );
    } else if (babelTypes.isArrowFunctionExpression(declarator.init)) {
      const body = babelTypes.isBlockStatement(declarator.init.body)
        ? declarator.init.body
        : babelTypes.blockStatement([
            babelTypes.returnStatement(declarator.init.body),
          ]);

      return babelTypes.functionDeclaration(
        babelTypes.identifier(name),
        declarator.init.params,
        body,
        false,
        declarator.init.async
      );
    }
    return null;
  }

  /**
   * tạo thư mục đầu ra trường hợp không có
   */
  createFolderOutput(extractConfig) {
    let arrayFolder = new Set(extractConfig.map((x) => x.outputDir));
    if (arrayFolder && arrayFolder.size > 0) {
      arrayFolder.forEach((outputDir) => {
        if (outputDir) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
      });
    }
  }

  /**
   * thêm import các file vừa tạo vào đầu file gốc
   */
  addImportToSourceFile(importsToAdd, ast) {
    if (importsToAdd.length > 0) {
      const importStatements = importsToAdd.map((imp) =>
        babelTypes.importDeclaration(
          [babelTypes.importDefaultSpecifier(babelTypes.identifier(imp.name))],
          babelTypes.stringLiteral(imp.path)
        )
      );

      if (ast && ast.body) {
        ast.body.unshift(...importStatements);
      }
    }
  }

  /**
   * lấy ra cấu hình hiện tại dựa vào config
   */
  getCurrentItemsFromConfig(extractConfig, name) {
    let result = null;
    if (extractConfig && extractConfig.length > 0 && name) {
      result = extractConfig.find((x) => x.items.includes(name));
    }
    return result;
  }

  /**
   * tạo báo cáo file js
   */
  traverseCodeForSplit(
    ast,
    extractConfig,
    me,
    notFound,
    extractedItems,
    importsToAdd,
    fileNodesMap
  ) {
    traverse(ast, {
      FunctionDeclaration: (path) => {
        const name = path.node.id.name;
        const cfg = me.getCurrentItemsFromConfig(extractConfig, name);
        if (cfg) {
          me.addToFile(
            name,
            path.node,
            cfg,
            extractedItems,
            importsToAdd,
            fileNodesMap
          );
          path.remove();
          me.removeFromListQuery(notFound, name, cfg);
        }
      },
      VariableDeclaration: (path) => {
        for (const decl of path.node.declarations) {
          const name = decl.id.name;
          const cfg = me.getCurrentItemsFromConfig(extractConfig, name);
          if (
            cfg &&
            (babelTypes.isFunctionExpression(decl.init) ||
              babelTypes.isArrowFunctionExpression(decl.init))
          ) {
            const funcNode = me.createFunctionFromDeclarator(decl, name);
            me.addToFile(
              name,
              funcNode,
              cfg,
              extractedItems,
              importsToAdd,
              fileNodesMap
            );
            me.removeFromListQuery(notFound, name, cfg);
            if (path.node.declarations.length === 1) {
              path.remove();
            } else {
              path.node.declarations = path.node.declarations.filter(
                (d) => d.id.name !== name
              );
            }
          }
        }
      },
      ClassDeclaration: (path) => {
        const name = path.node.id.name;
        const cfg = me.getCurrentItemsFromConfig(extractConfig, name);
        if (cfg) {
          me.addToFile(
            name,
            path.node,
            cfg,
            extractedItems,
            importsToAdd,
            fileNodesMap
          );
          path.remove();
          me.removeFromListQuery(notFound, name, cfg);
        }
      },
    });
  }

  removeFromListQuery(notFound, name, currentConfig) {
    if (currentConfig?.items?.length) {
      currentConfig.items = currentConfig.items.filter((x) => x != name);
      // xoá config khi đã hết items
      if (currentConfig.items.length === 0) {
        notFound = notFound.filter(
          (x) => x.splitedSubName != currentConfig.splitedSubName
        );
      }
    }
  }
  /**
   * xuất function
   */
  extractFunction(nodePath, name, currentConfig, extractedItems, importsToAdd) {
    const functionNode = nodePath.node;
    let getOutputConfig = this.getOutputConfig(currentConfig);
    const filePath = path.join(
      getOutputConfig.outputDir,
      getOutputConfig.fileName
    );
    const relativePath = this.buildImportPathFile(filePath);

    // Create the export statement
    const exportStatement = babelTypes.exportDefaultDeclaration(functionNode);

    // Create new AST for the extracted file
    const newAst = babelTypes.program([exportStatement], [], "module");

    const extractedCode = generate(newAst, {
      retainLines: false,
      comments: true,
    }).code;

    // Write the extracted file
    fs.appendFileSync(filePath, extractedCode, this._encodeType);

    extractedItems.push({
      name,
      fileName: getOutputConfig.fileName,
      path: filePath,
    });
    importsToAdd.push({ name, path: relativePath });

    // Remove the original function from the AST
    nodePath.remove();
  }

  /**
   * build ra đường dẫn file import vào file gốc
   */
  buildImportPathFile(filePath) {
    return `./${path
      .relative(path.dirname(path.resolve(process.cwd())), filePath)
      .replace(/\\/g, "/")}`.replace(".js", "");
  }

  /**
   * lấy ra config đầu ra
   */
  getOutputConfig(currentConfig) {
    let config = {};
    config.outputDir = currentConfig.outputDir;
    config.fileName =
      currentConfig.file.replace(".js", "") +
      "." +
      currentConfig.splitedSubName +
      ".js";
    return config;
  }

  /**
   * xuất function dạng khai báo biến
   */
  extractFunctionVariable(
    nodePath,
    name,
    currentConfig,
    extractedItems,
    importsToAdd
  ) {
    let getOutputConfig = this.getOutputConfig(currentConfig);
    const filePath = path.join(
      getOutputConfig.outputDir,
      getOutputConfig.fileName
    );
    const relativePath = this.buildImportPathFile(filePath);

    // Find the specific declarator
    const declarator = nodePath.node.declarations.find(
      (d) => d.id.name === name
    );

    // Create function declaration from the function expression/arrow function
    let functionDeclaration;
    if (babelTypes.isFunctionExpression(declarator.init)) {
      functionDeclaration = babelTypes.functionDeclaration(
        babelTypes.identifier(name),
        declarator.init.params,
        declarator.init.body,
        declarator.init.generator,
        declarator.init.async
      );
    } else if (babelTypes.isArrowFunctionExpression(declarator.init)) {
      // Convert arrow function to regular function for export
      const body = babelTypes.isBlockStatement(declarator.init.body)
        ? declarator.init.body
        : babelTypes.blockStatement([
            babelTypes.returnStatement(declarator.init.body),
          ]);

      functionDeclaration = babelTypes.functionDeclaration(
        babelTypes.identifier(name),
        declarator.init.params,
        body,
        false,
        declarator.init.async
      );
    }

    // Create the export statement
    const exportStatement =
      babelTypes.exportDefaultDeclaration(functionDeclaration);

    // Create new AST for the extracted file
    const newAst = babelTypes.program([exportStatement], [], "module");

    const extractedCode = generate(newAst, {
      retainLines: false,
      comments: true,
    }).code;

    // Write the extracted file
    fs.appendFileSync(filePath, extractedCode, this._encodeType);

    extractedItems.push({
      name,
      fileName: getOutputConfig.fileName,
      path: filePath,
    });
    importsToAdd.push({ name, path: relativePath });

    // Remove the variable declaration or just this declarator
    if (nodePath.node.declarations.length === 1) {
      nodePath.remove();
    } else {
      nodePath.node.declarations = nodePath.node.declarations.filter(
        (d) => d.id.name !== name
      );
    }
  }

  /**
   * xuất class
   */
  extractClass(nodePath, name, currentConfig, extractedItems, importsToAdd) {
    const classNode = nodePath.node;
    let getOutputConfig = this.getOutputConfig(currentConfig);
    const filePath = path.join(
      getOutputConfig.outputDir,
      getOutputConfig.fileName
    );
    const relativePath = this.buildImportPathFile(filePath);

    // Create the export statement
    const exportStatement = babelTypes.exportDefaultDeclaration(classNode);

    // Create new AST for the extracted file
    const newAst = babelTypes.program([exportStatement], [], "module");

    const extractedCode = generate(newAst, {
      retainLines: false,
      comments: true,
    }).code;

    // Write the extracted file
    fs.writeFileSync(filePath, extractedCode, "utf8");

    extractedItems.push({
      name,
      fileName: getOutputConfig.fileName,
      path: filePath,
    });
    importsToAdd.push({ name, path: relativePath });

    // Remove the original class from the AST
    nodePath.remove();
  }

  // end region method
}

export default new RefactorJS();
