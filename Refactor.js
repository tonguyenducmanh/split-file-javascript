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

  // NEW HELPER: Trích xuất tên gốc và tên mới từ item trong config
  getIdentifierNames(item) {
    if (typeof item === "string") {
      return { originalName: item, newName: item };
    }
    if (typeof item === "object" && item.name) {
      return { originalName: item.name, newName: item.newName || item.name };
    }
    if (typeof item === "object" && item.class) {
      return { originalName: item.class, newName: item.newName || item.class };
    }
    return null;
  }

  splitFile(extractConfig) {
    let me = this;
    const extractedItems = [];
    const notFound = [...extractConfig];
    if (extractConfig && extractConfig.length > 0) {
      extractConfig.forEach((config) => {
        const code = fs.readFileSync(config.filePath, this._encodeType);
        const ast = this.parseSource(code);

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
        fs.writeFileSync(config.filePath, modifiedCode, this._encodeType);
      });
    }
    return { extractedItems, notFound };
  }

  // MODIFIED: Cập nhật hàm addToFile để xử lý tên mới
  addToFile(
    originalName,
    newName,
    node,
    currentConfig,
    extractedItems,
    importsToAdd,
    fileNodesMap
  ) {
    const output = this.getOutputConfig(currentConfig);
    const key = path.join(output.importCofig, output.fileName);
    if (!fileNodesMap.has(key)) fileNodesMap.set(key, []);

    // Đổi tên node trước khi thêm
    if (node.id) {
      node.id = babelTypes.identifier(newName);
    }

    fileNodesMap.get(key).push({ node, name: newName });

    const relativePath = this.buildImportPathFile(key);
    extractedItems.push({
      name: newName,
      fileName: output.fileName,
      path: this.getFullPathForNewFile(currentConfig),
    });
    importsToAdd.push({ originalName, newName, path: relativePath });
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

  // MODIFIED: Đảm bảo hàm được tạo ra có tên mới
  createFunctionFromMethod(methodNode, newFunctionName) {
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

  // MODIFIED: Proxy phải gọi đến hàm với tên mới
  createProxyMethod(originalMethodNode, proxyFunctionName) {
    const methodName = originalMethodNode.key.name;

    const callArguments = [
      babelTypes.thisExpression(),
      ...originalMethodNode.params.map((p) =>
        babelTypes.identifier(p.id ? p.id.name : p.name)
      ),
    ];

    const returnStatement = babelTypes.returnStatement(
      babelTypes.callExpression(
        babelTypes.identifier(proxyFunctionName),
        callArguments
      )
    );
    const newBody = babelTypes.blockStatement([returnStatement]);

    // Tên phương thức trong class vẫn giữ nguyên
    return babelTypes.classMethod(
      "method",
      babelTypes.identifier(methodName),
      originalMethodNode.params,
      newBody
    );
  }
  // MODIFIED: Tạo import với alias: import { newName as originalName } from '...'
  addImportToSourceFile(importsToAdd, ast) {
    if (importsToAdd.length > 0) {
      const importGroups = new Map();
      importsToAdd.forEach((imp) => {
        if (!importGroups.has(imp.path)) {
          importGroups.set(imp.path, []);
        }
        importGroups.get(imp.path).push(imp);
      });

      const importStatements = [];
      for (const [path, imps] of importGroups.entries()) {
        const specifiers = imps.map((imp) =>
          babelTypes.importSpecifier(
            babelTypes.identifier(imp.originalName),
            babelTypes.identifier(imp.newName)
          )
        );
        importStatements.push(
          babelTypes.importDeclaration(
            specifiers,
            babelTypes.stringLiteral(path)
          )
        );
      }

      if (ast && ast.program && ast.program.body) {
        ast.program.body.unshift(...importStatements);
      }
    }
  }

  // MODIFIED: Cập nhật hàm để tìm kiếm dựa trên tên gốc
  getCurrentItemsFromConfig(extractConfig, originalName) {
    if (!extractConfig || extractConfig.length === 0 || !originalName) {
      return null;
    }
    return extractConfig.find((config) => {
      return config.items.some((item) => {
        const names = this.getIdentifierNames(item);
        return names && names.originalName === originalName;
      });
    });
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
        const originalName = path.node.id.name;
        const cfg = me.getCurrentItemsFromConfig(extractConfig, originalName);
        if (cfg) {
          const itemConfig = cfg.items.find(
            (i) => me.getIdentifierNames(i)?.originalName === originalName
          );
          if (itemConfig) {
            const { newName } = me.getIdentifierNames(itemConfig);
            me.addToFile(
              originalName,
              newName,
              path.node,
              cfg,
              extractedItems,
              importsToAdd,
              fileNodesMap
            );
            path.remove();
            me.removeFromListQuery(notFound, originalName, cfg);
          }
        }
      },
      VariableDeclaration: (path) => {
        for (const decl of path.node.declarations) {
          const originalName = decl.id.name;
          const cfg = me.getCurrentItemsFromConfig(extractConfig, originalName);
          if (cfg) {
            const itemConfig = cfg.items.find(
              (i) => me.getIdentifierNames(i)?.originalName === originalName
            );
            if (
              itemConfig &&
              (babelTypes.isFunctionExpression(decl.init) ||
                babelTypes.isArrowFunctionExpression(decl.init))
            ) {
              const { newName } = me.getIdentifierNames(itemConfig);
              const funcNode = me.createFunctionFromDeclarator(decl, newName);
              me.addToFile(
                originalName,
                newName,
                funcNode,
                cfg,
                extractedItems,
                importsToAdd,
                fileNodesMap
              );
              me.removeFromListQuery(notFound, originalName, cfg);
              if (path.node.declarations.length === 1) {
                path.remove();
              } else {
                path.node.declarations = path.node.declarations.filter(
                  (d) => d.id.name !== originalName
                );
              }
            }
          }
        }
      },
      ClassDeclaration: (path) => {
        const originalName = path.node.id.name;
        const cfg = me.getCurrentItemsFromConfig(extractConfig, originalName);
        if (cfg) {
          const itemConfig = cfg.items.find(
            (item) => me.getIdentifierNames(item)?.originalName === originalName
          );

          if (typeof itemConfig === "object" && !itemConfig.methods) {
            // Tách cả class với tên mới
            const { newName } = me.getIdentifierNames(itemConfig);
            me.addToFile(
              originalName,
              newName,
              path.node,
              cfg,
              extractedItems,
              importsToAdd,
              fileNodesMap
            );
            path.remove();
            me.removeFromListQuery(notFound, originalName, cfg);
          } else if (typeof itemConfig === "object" && itemConfig.methods) {
            // Tách các method trong class
            const methodsToExtract = new Map(
              itemConfig.methods.map((m) => {
                const names = me.getIdentifierNames(m);
                return [names.originalName, names];
              })
            );
            const updatedBody = [];

            path.get("body.body").forEach((methodPath) => {
              const originalMethodNode = methodPath.node;
              const originalMethodName = originalMethodNode.key.name;

              if (
                methodPath.isClassMethod() &&
                methodsToExtract.has(originalMethodName)
              ) {
                const { newName: newMethodName } =
                  methodsToExtract.get(originalMethodName);

                const standaloneFunctionNode = me.createFunctionFromMethod(
                  originalMethodNode,
                  newMethodName
                );
                me.addToFile(
                  originalMethodName,
                  newMethodName,
                  standaloneFunctionNode,
                  cfg,
                  extractedItems,
                  importsToAdd,
                  fileNodesMap
                );

                const proxyMethodNode = me.createProxyMethod(
                  originalMethodNode,
                  newMethodName
                );
                updatedBody.push(proxyMethodNode);
              } else {
                updatedBody.push(originalMethodNode);
              }
            });

            path.node.body.body = updatedBody;
            me.removeFromListQuery(
              notFound,
              originalName,
              cfg,
              Array.from(methodsToExtract.keys())
            );
          }
        }
      },
    });
  }

  removeFromListQuery(notFound, name, currentConfig, methods = null) {
    if (!currentConfig) return;
    const getItemName = (item) =>
      typeof item === "string" ? item : item.name || item.class;

    if (methods) {
      const item = currentConfig.items.find(
        (i) => typeof i === "object" && i.class === name
      );
      if (item) {
        item.methods = item.methods.filter(
          (m) => !methods.includes(getItemName(m))
        );
        if (item.methods.length === 0) {
          currentConfig.items = currentConfig.items.filter(
            (i) => getItemName(i) !== name
          );
        }
      }
    } else {
      currentConfig.items = currentConfig.items.filter(
        (i) => getItemName(i) !== name
      );
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
    return `./${relativePath.replace(/\\/g, "/")}`;
  }
  getOutputConfig(currentConfig) {
    let config = {};
    config.importCofig = "./";
    config.fileName = currentConfig.splitedSubName;
    return config;
  }
  getFullPathForNewFile(currentConfig) {
    let soureFilePath = path.dirname(currentConfig.filePath);
    let fileName = currentConfig.splitedSubName;
    return path.join(soureFilePath, fileName);
  }
}

export default new RefactorJS();
