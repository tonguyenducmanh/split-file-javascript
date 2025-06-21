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
      functionDeclarations: [],
      // danh sách function dạng biểu thức
      functionExpressions: [],
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
        kind: method.kind,
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
  createFunctionFromMethod(methodNode, className) {
    // const newFunctionName = `${className}_${methodNode.key.name}`;
    const newFunctionName = methodNode.key.name;

    const params = methodNode.static
      ? methodNode.params
      : [babelTypes.identifier("instance"), ...methodNode.params];

    return babelTypes.functionDeclaration(
      babelTypes.identifier(newFunctionName),
      params,
      methodNode.body,
      methodNode.generator,
      methodNode.async
    );
  }

  // NEW: Function to create the proxy method
  /**
   * Tạo ra một phương thức proxy để thay thế phương thức gốc trong class.
   * Phương thức này sẽ gọi đến hàm đã được tách ra.
   * @param {Node} originalMethodNode - AST node của MethodDefinition gốc.
   * @param {string} className - Tên của class cha.
   * @returns {Node} - AST node của ClassMethod mới.
   */
  createProxyMethod(originalMethodNode, className) {
    const methodName = originalMethodNode.key.name;
    // const proxyFunctionName = `${classNamer}_${methodName}`;
    const proxyFunctionName = methodName;

    // Các tham số cho lời gọi hàm (this, arg1, arg2, ...)
    const callArguments = [
      babelTypes.thisExpression(),
      ...originalMethodNode.params.map((p) =>
        babelTypes.identifier(p.id ? p.id.name : p.name)
      ), // Handle different param structures
    ];

    // Tạo câu lệnh `return functionName(this, ...args);`
    const returnStatement = babelTypes.returnStatement(
      babelTypes.callExpression(
        babelTypes.identifier(proxyFunctionName),
        callArguments
      )
    );

    // Tạo thân hàm mới
    const newBody = babelTypes.blockStatement([returnStatement]);

    // Tạo định nghĩa phương thức mới (ClassMethod)
    return babelTypes.classMethod(
      "method",
      babelTypes.identifier(methodName),
      originalMethodNode.params,
      newBody
    );
  }

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
      let importList = [];
      let importStatements = [];
      importsToAdd.forEach((imp) => {
        let importItem = babelTypes.importSpecifier(
          babelTypes.identifier(imp.name),
          babelTypes.identifier(imp.name)
        );
        let currentImport = importList.find((x) => x.path == imp.path);

        if (currentImport) {
          currentImport.listItem.push(importItem);
        } else {
          importList.push({
            path: imp.path,
            listItem: [importItem],
          });
        }
      });
      if (importList && importList.length > 0) {
        importList.forEach((item) => {
          importStatements.push(
            babelTypes.importDeclaration(
              item.listItem,
              babelTypes.stringLiteral(item.path)
            )
          );
        });
      }

      if (ast && ast.program && ast.program.body) {
        ast.program.body.unshift(...importStatements);
      }
    }
  }

  /**
   * lấy ra cấu hình hiện tại dựa vào config
   */
  getCurrentItemsFromConfig(extractConfig, name) {
    let result = null;
    if (extractConfig && extractConfig.length > 0 && name) {
      result = extractConfig.find((config) => {
        return config.items.some((item) => {
          if (typeof item === "string") {
            return item === name;
          }
          if (typeof item === "object" && item.class) {
            return item.class === name;
          }
          return false;
        });
      });
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
        if (cfg && typeof cfg.items.find((i) => i === name) === "string") {
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
            typeof cfg.items.find((i) => i === name) === "string" &&
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
          const itemConfig = cfg.items.find(
            (item) =>
              (typeof item === "string" && item === name) ||
              (typeof item === "object" && item.class === name)
          );

          if (typeof itemConfig === "string") {
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
          } else if (typeof itemConfig === "object" && itemConfig.methods) {
            const methodsToExtract = new Set(itemConfig.methods);
            const updatedBody = []; // This will be the new body of the class

            path.get("body.body").forEach((methodPath) => {
              const originalMethodNode = methodPath.node;
              if (
                methodPath.isClassMethod() &&
                methodsToExtract.has(originalMethodNode.key.name)
              ) {
                // Step 1: Create the standalone function to be exported
                // const newFunctionName = `${name}_${originalMethodNode.key.name}`;
                const newFunctionName = originalMethodNode.key.name;
                const standaloneFunctionNode = me.createFunctionFromMethod(
                  originalMethodNode,
                  name
                );
                me.addToFile(
                  newFunctionName,
                  standaloneFunctionNode,
                  cfg,
                  extractedItems,
                  importsToAdd,
                  fileNodesMap
                );

                // Step 2: Create and add the proxy method to the class body
                const proxyMethodNode = me.createProxyMethod(
                  originalMethodNode,
                  name
                );
                updatedBody.push(proxyMethodNode);
              } else {
                // Keep the method that is not being extracted
                updatedBody.push(originalMethodNode);
              }
            });

            // Replace the old class body with the new one
            path.node.body.body = updatedBody;
            me.removeFromListQuery(notFound, name, cfg, itemConfig.methods);
          }
        }
      },
    });
  }

  removeFromListQuery(notFound, name, currentConfig, methods = null) {
    if (!currentConfig) return;
    if (methods) {
      const item = currentConfig.items.find(
        (i) => typeof i === "object" && i.class === name
      );
      if (item) {
        item.methods = item.methods.filter((m) => !methods.includes(m));
        if (item.methods.length === 0) {
          currentConfig.items = currentConfig.items.filter((i) => i !== item);
        }
      }
    } else {
      currentConfig.items = currentConfig.items.filter((i) => i !== name);
    }
    if (currentConfig.items.length === 0) {
      const index = notFound.findIndex(
        (cfg) => cfg.splitedSubName === currentConfig.splitedSubName
      );
      if (index > -1) {
        notFound.splice(index, 1);
      }
    }
  }
  buildImportPathFile(filePath) {
    const relativePath = path.relative(process.cwd(), filePath);
    return `./${relativePath.replace(/\\/g, "/")}`.replace(/\.js$/, "");
  }
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
}

export default new RefactorJS();
