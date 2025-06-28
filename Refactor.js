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
  ClassMethod: "ClassMethod",
  VariableDeclarator: "VariableDeclarator",
  AssignmentExpression: "AssignmentExpression",
  Property: "Property",
  Anonymous: "Anonymous",
  Unknown: "Unknown",
  CallExpression: "CallExpression", // Thêm CallExpression
  NewExpression: "NewExpression", // Thêm NewExpression
  FunctionDeclaration: "FunctionDeclaration", // Thêm để dễ tham chiếu
  FunctionExpression: "FunctionExpression", // Thêm để dễ tham chiếu
  ArrowFunctionExpression: "ArrowFunctionExpression", // Thêm để dễ tham chiếu
  ObjectMethod: "ObjectMethod", // Thêm cho Vue methods
  ObjectExpression: "ObjectExpression", // Thêm cho Vue component object
  ExportDefaultDeclaration: "ExportDefaultDeclaration", // Thêm cho Vue export
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
    const analysis = this.initNewAnalysisCode(filePath);

    // tạo báo cáo file js (chỉ thu thập khai báo ban đầu)
    this.traverseCodeForAnalyzeDeclarations(analysis, ast);

    // Tạo một bản đồ để dễ dàng tra cứu thông tin hàm/lớp bằng tên
    const functionMap = new Map();
    analysis.functionDeclarations.forEach((func) =>
      functionMap.set(func.name, func)
    );
    analysis.classDeclarations.forEach((cls) => {
      functionMap.set(cls.name, cls); // Thêm class
      cls.methods.forEach((method) =>
        functionMap.set(`${cls.name}.${method.name}`, method)
      ); // Thêm method của class
    });

    // Thêm bước duyệt mới để phân tích các lời gọi hàm
    this.traverseCodeForAnalyzeCalls(analysis, ast, functionMap);

    // tính tổng
    this.caculateTotal(analysis);

    return analysis;
  }

  createFolderOutput(saveResultPath) {
    if (saveResultPath) {
      fs.mkdirSync(saveResultPath, { recursive: true });
    }
  }

  /**
   * phân tích cấu trúc và các method, function có trong 1 file javascript
   * @param {String} folderPath đường dẫn folder để lấy các file cần thống kê
   * @param {String} saveResultPath đường dẫn folder để lưu kết quả nếu có
   */
  analyzeFiles(folderPath, saveResultPath) {
    let analysis = [];
    if (folderPath) {
      let allFile = this.findAllJsFiles(folderPath);
      if (allFile && allFile.length > 0) {
        allFile.forEach((item) => {
          let singleAnalysis = this.analyzeFile(item);
          if (singleAnalysis) {
            analysis.push(singleAnalysis);
          }
        });
      }
    }
    if (saveResultPath) {
      let dirName = path.dirname(saveResultPath);
      let fileResult = path.basename(saveResultPath) ?? "result.json";
      this.createFolderOutput(dirName);
      let resultPath = path.join(dirName, fileResult);
      fs.writeFileSync(
        resultPath,
        JSON.stringify(analysis, null, 2),
        this._encodeType
      );
    }
    return analysis;
  }

  /**
   * Tìm tất cả các file JavaScript trong một thư mục (và các thư mục con).
   * @param {string} dirPath - Đường dẫn đến thư mục cần quét.
   * @returns {string[]} Một mảng chứa đường dẫn tuyệt đối của tất cả các file .js tìm thấy.
   */
  findAllJsFiles(dirPath) {
    let jsFiles = []; // Mảng để lưu trữ các file .js tìm thấy

    // Đọc tất cả các mục (file và thư mục con) trong đường dẫn đã cho
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item); // Tạo đường dẫn đầy đủ cho từng mục
      let fullPathItem = path.resolve(itemPath);
      const stats = fs.statSync(itemPath); // Lấy thông tin về mục (file hay thư mục)

      if (stats.isFile() && path.extname(item) === ".js") {
        // Nếu là file và có đuôi .js, thêm vào danh sách
        jsFiles.push(fullPathItem);
      } else if (stats.isDirectory()) {
        // Nếu là thư mục, đệ quy gọi lại hàm để quét sâu hơn
        jsFiles = jsFiles.concat(this.findAllJsFiles(itemPath));
      }
    }
    return jsFiles;
  }

  /**
   * tính tổng
   */
  caculateTotal(analysis) {
    analysis.totalFunctions = analysis.functionDeclarations.length;
    analysis.totalClasses = analysis.classDeclarations.length;
  }

  getTotalLineOfNode(node) {
    let totalLength = 0;
    if (node && node.loc) {
      let startLine = node.loc.start ? node.loc.start.line : 0;
      let endLine = node.loc.end ? node.loc.end.line : 0;
      totalLength = endLine - startLine + 1;
    }
    return totalLength;
  }

  /**
   * dùng thư viện @babel/traverse để phân tích code và thu thập khai báo hàm/lớp.
   * @param {Object} analysis đối tượng cần lưu phân tích
   * @param {Object} ast cấu trúc abstract syntax tree của file javascript
   */
  traverseCodeForAnalyzeDeclarations(analysis, ast) {
    let me = this;

    let optionTraverse = {
      FunctionDeclaration(nodePath) {
        const node = nodePath.node;
        analysis.functionDeclarations.push({
          name: node.id ? node.id.name : refactorConstant.Anonymous,
          totalLine: me.getTotalLineOfNode(node),
          startLine: node.loc ? node.loc.start.line : null,
          endLine: node.loc ? node.loc.end.line : null,
          references: [], // Khởi tạo mảng references
        });
      },
      FunctionExpression(nodePath) {
        const node = nodePath.node;
        // Bỏ qua các FunctionExpression là method của class hoặc property
        if (
          nodePath.parent.type === refactorConstant.MethodDefinition ||
          nodePath.parent.type === refactorConstant.Property
        ) {
          return;
        }
        analysis.functionDeclarations.push({
          name: node.id ? node.id.name : me.getVariableName(nodePath),
          totalLine: me.getTotalLineOfNode(node),
          startLine: node.loc ? node.loc.start.line : null,
          endLine: node.loc ? node.loc.end.line : null,
          references: [], // Khởi tạo mảng references
        });
      },
      ArrowFunctionExpression(nodePath) {
        const node = nodePath.node;
        // Bỏ qua các ArrowFunctionExpression là method của class hoặc property
        if (
          nodePath.parent.type === refactorConstant.MethodDefinition ||
          nodePath.parent.type === refactorConstant.Property
        ) {
          return;
        }
        analysis.functionDeclarations.push({
          name: me.getVariableName(nodePath),
          totalLine: me.getTotalLineOfNode(node),
          startLine: node.loc ? node.loc.start.line : null,
          endLine: node.loc ? node.loc.end.line : null,
          references: [], // Khởi tạo mảng references
        });
      },
      ClassDeclaration(nodePath) {
        const node = nodePath.node;
        const className = node.id ? node.id.name : refactorConstant.Anonymous;
        const classLine = me.getTotalLineOfNode(node);

        let classInfo = {
          name: className,
          totalLine: classLine,
          startLine: node.loc ? node.loc.start.line : null,
          endLine: node.loc ? node.loc.end.line : null,
          methods: [], // Thêm trường này để lưu trữ các method con
          references: [], // Khởi tạo mảng references cho class
        };

        // Duyệt qua body của class để tìm các method
        if (node.body && node.body.type === "ClassBody") {
          node.body.body.forEach((classBodyNode) => {
            if (classBodyNode.type === refactorConstant.ClassMethod) {
              let nameClassMethod = classBodyNode.key
                ? classBodyNode.key.name
                : refactorConstant.Anonymous;
              if (nameClassMethod !== "constructor") {
                // Bỏ qua constructor
                classInfo.methods.push({
                  name: nameClassMethod,
                  totalLine: me.getTotalLineOfNode(classBodyNode),
                  startLine: classBodyNode.loc
                    ? classBodyNode.loc.start.line
                    : null,
                  endLine: classBodyNode.loc
                    ? classBodyNode.loc.end.line
                    : null,
                  references: [], // Khởi tạo mảng references cho method
                });
              }
            }
          });
        }
        analysis.classDeclarations.push(classInfo);
      },
    };
    traverse(ast, optionTraverse);
  }

  /**
   * Dùng thư viện @babel/traverse để phân tích các lời gọi hàm và cập nhật trường references.
   * Đây là một bước duyệt riêng sau khi đã thu thập tất cả các khai báo.
   * @param {Object} analysis - Đối tượng cần lưu phân tích (đã có khai báo hàm/lớp).
   * @param {Object} ast - Cấu trúc Abstract Syntax Tree của file JavaScript.
   * @param {Map<string, Object>} functionMap - Bản đồ chứa tất cả các hàm/lớp/method đã được khai báo để tra cứu nhanh.
   */
  traverseCodeForAnalyzeCalls(analysis, ast, functionMap) {
    let me = this;

    traverse(ast, {
      CallExpression(nodePath) {
        const node = nodePath.node;
        let calleeName = null; // Tên hàm được gọi

        if (babelTypes.isIdentifier(node.callee)) {
          // Ví dụ: myFunction()
          calleeName = node.callee.name;
        } else if (babelTypes.isMemberExpression(node.callee)) {
          // Ví dụ: object.method(), Class.staticMethod()
          if (babelTypes.isIdentifier(node.callee.property)) {
            // Trường hợp object.method
            calleeName = node.callee.property.name;
            // Cố gắng xác định tên lớp nếu là Class.staticMethod
            if (babelTypes.isIdentifier(node.callee.object)) {
              const objectName = node.callee.object.name;
              // Kiểm tra xem objectName có phải là tên lớp đã khai báo không
              const classInfo = analysis.classDeclarations.find(
                (cls) => cls.name === objectName
              );
              if (classInfo) {
                calleeName = `${objectName}.${calleeName}`; // Định dạng ClassName.methodName
              }
            }
          }
        }
        // Thêm logic để xử lý các loại callee khác nếu cần (ví dụ: Function.prototype.call/apply)
        // Hiện tại chỉ tập trung vào các lời gọi trực tiếp.

        if (calleeName) {
          // Tìm hàm (hoặc method của class) chứa lời gọi này
          const callingFunctionInfo = me.findParentFunctionOrClass(nodePath);

          if (callingFunctionInfo) {
            const {
              name: callingFunctionName,
              type: callingFunctionType,
              parentName: callingFunctionParentName,
            } = callingFunctionInfo;

            // Định dạng tên hàm gọi
            let callerIdentifier = callingFunctionName;
            if (callingFunctionParentName) {
              callerIdentifier = `${callingFunctionParentName}.${callingFunctionName}`;
            }

            // Tìm thông tin của hàm được gọi trong functionMap
            const targetFunction = functionMap.get(calleeName);
            // Kiểm tra cả các method của lớp nếu calleeName là một method độc lập
            if (!targetFunction && calleeName.includes(".")) {
              const [className, methodName] = calleeName.split(".");
              const cls = functionMap.get(className);
              if (cls && cls.methods) {
                const method = cls.methods.find((m) => m.name === methodName);
                if (method) {
                  // Cập nhật calleeName để khớp với định dạng trong functionMap cho method
                  calleeName = `${className}.${methodName}`;
                }
              }
            }

            // Lấy lại target function sau khi chuẩn hóa calleeName
            const finalTargetFunction = functionMap.get(calleeName);

            if (finalTargetFunction) {
              // Thêm thông tin về hàm gọi vào trường references của hàm được gọi
              const referenceEntry = {
                name: callerIdentifier,
                type: callingFunctionType,
                startLine: node.loc ? node.loc.start.line : null,
                endLine: node.loc ? node.loc.end.line : null,
              };

              // Đảm bảo trường references tồn tại
              if (!finalTargetFunction.references) {
                finalTargetFunction.references = [];
              }
              finalTargetFunction.references.push(referenceEntry);
            }
          }
        }
      },
      NewExpression(nodePath) {
        // Thêm NewExpression
        const node = nodePath.node;
        if (babelTypes.isIdentifier(node.callee)) {
          const className = node.callee.name;
          // Tìm thông tin class trong analysis
          const classInfo = analysis.classDeclarations.find(
            (cls) => cls.name === className
          );
          if (classInfo) {
            const callingFunctionInfo = me.findParentFunctionOrClass(nodePath);
            if (callingFunctionInfo) {
              const {
                name: callingFunctionName,
                type: callingFunctionType,
                parentName: callingFunctionParentName,
              } = callingFunctionInfo;
              let callerIdentifier = callingFunctionName;
              if (callingFunctionParentName) {
                callerIdentifier = `${callingFunctionParentName}-${callingFunctionName}`;
              }

              const referenceEntry = {
                name: callerIdentifier,
                type: refactorConstant.NewExpression, // Đánh dấu là khởi tạo class
                startLine: node.loc ? node.loc.start.line : null,
                endLine: node.loc ? node.loc.end.line : null,
              };
              if (!classInfo.references) {
                classInfo.references = [];
              }
              classInfo.references.push(referenceEntry);
            }
          }
        }
      },
    });
  }

  /**
   * Tìm hàm hoặc lớp cha gần nhất của một node.
   * @param {Object} nodePath - Babel nodePath của CallExpression.
   * @returns {{name: string, type: string, parentName?: string}|null} Thông tin về hàm/lớp cha, hoặc null nếu không tìm thấy.
   */
  findParentFunctionOrClass(nodePath) {
    let currentPath = nodePath;
    while (currentPath) {
      const node = currentPath.node;

      // Xử lý Function Declaration
      if (node.type === refactorConstant.FunctionDeclaration) {
        return {
          name: node.id ? node.id.name : refactorConstant.Anonymous,
          type: refactorConstant.FunctionDeclaration,
        };
      }
      // Xử lý Function Expression (bao gồm cả arrow functions gán cho biến)
      if (
        node.type === refactorConstant.FunctionExpression ||
        node.type === refactorConstant.ArrowFunctionExpression
      ) {
        if (
          currentPath.parent.type === refactorConstant.VariableDeclarator &&
          babelTypes.isIdentifier(currentPath.parent.id)
        ) {
          return {
            name: currentPath.parent.id.name,
            type: refactorConstant.VariableDeclarator,
          };
        }
        if (
          currentPath.parent.type === refactorConstant.AssignmentExpression &&
          babelTypes.isIdentifier(currentPath.parent.left)
        ) {
          return {
            name: currentPath.parent.left.name,
            type: refactorConstant.AssignmentExpression,
          };
        }
        if (
          currentPath.parent.type === refactorConstant.Property &&
          babelTypes.isIdentifier(currentPath.parent.key)
        ) {
          // Đây là một method trong Object Literal
          return {
            name: currentPath.parent.key.name,
            type: refactorConstant.Property,
          };
        }
        // Nếu không được gán tường minh (anonymous IIFE, callback...)
        return { name: refactorConstant.Anonymous, type: node.type };
      }
      // Xử lý Class Method
      if (node.type === refactorConstant.ClassMethod) {
        const classNameNode = currentPath.findParent(
          (p) => p.isClassDeclaration() || p.isClassExpression()
        );
        const className =
          classNameNode && classNameNode.node.id
            ? classNameNode.node.id.name
            : refactorConstant.Anonymous;
        return {
          name: node.key.name,
          type: refactorConstant.ClassMethod,
          parentName: className,
        };
      }
      // Xử lý Class Declaration
      if (node.type === refactorConstant.ClassDeclaration) {
        return {
          name: node.id ? node.id.name : refactorConstant.Anonymous,
          type: refactorConstant.ClassDeclaration,
        };
      }

      currentPath = currentPath.parentPath;
    }
    return null; // Không tìm thấy hàm hoặc lớp cha
  }

  /**
   * init default thống kê về các thông tin của 1 file
   * @returns analysis
   */
  initNewAnalysisCode(filePath) {
    return {
      filePath: path.resolve(filePath),
      functionDeclarations: [],
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

  /**
   * Phân tích các phụ thuộc giữa các thành phần đã tách
   * @param {Object} analysis - Kết quả phân tích từ analyzeFile
   * @param {Array} extractConfig - Cấu hình tách file
   * @returns {Map<string, Array<{name: string, originalName: string, newName: string, fileName: string}>>}
   *          Bản đồ các phụ thuộc: key là fileName, value là mảng các thành phần phụ thuộc
   */
  analyzeDependencies(analysis, extractConfig) {
    const dependencies = new Map(); // Lưu trữ phụ thuộc của mỗi file
    const itemToFileMap = new Map(); // Ánh xạ từ tên thành phần đến tên file

    // Tạo bản đồ ánh xạ từ tên thành phần đến tên file
    extractConfig.forEach((config) => {
      const fileName = config.splitedSubName;
      config.items.forEach((item) => {
        const { originalName, newName } = this.getIdentifierNames(item);
        itemToFileMap.set(originalName, {
          fileName,
          originalName,
          newName,
        });

        // Nếu là class, thêm cả các method
        if (typeof item === "object" && item.class) {
          const classInfo = analysis.classDeclarations.find(
            (cls) => cls.name === originalName
          );
          if (classInfo && classInfo.methods) {
            classInfo.methods.forEach((method) => {
              const methodKey = `${originalName}.${method.name}`;
              itemToFileMap.set(methodKey, {
                fileName,
                originalName: methodKey,
                newName: method.name,
                isClassMethod: true,
                className: originalName,
                classNewName: newName,
              });
            });
          }
        }
      });
    });

    // Phân tích phụ thuộc từ functionDeclarations
    analysis.functionDeclarations.forEach((func) => {
      if (func.references && func.references.length > 0) {
        func.references.forEach((ref) => {
          // Bỏ qua các references từ các phần không được tách
          if (!itemToFileMap.has(ref.name)) return;

          // Lấy thông tin về file chứa thành phần gọi
          const callerInfo = itemToFileMap.get(ref.name);

          // Lấy thông tin về file chứa thành phần được gọi
          const targetInfo = itemToFileMap.get(func.name);

          if (
            callerInfo &&
            targetInfo &&
            callerInfo.fileName !== targetInfo.fileName
          ) {
            // Nếu chưa có mảng phụ thuộc cho file này, tạo mới
            if (!dependencies.has(callerInfo.fileName)) {
              dependencies.set(callerInfo.fileName, []);
            }

            // Thêm phụ thuộc
            const dependencyArray = dependencies.get(callerInfo.fileName);
            if (
              !dependencyArray.some(
                (dep) => dep.originalName === targetInfo.originalName
              )
            ) {
              dependencyArray.push(targetInfo);
            }
          }
        });
      }
    });

    // Phân tích phụ thuộc từ classDeclarations
    analysis.classDeclarations.forEach((cls) => {
      // Xử lý các references của class
      if (cls.references && cls.references.length > 0) {
        cls.references.forEach((ref) => {
          if (!itemToFileMap.has(ref.name)) return;

          const callerInfo = itemToFileMap.get(ref.name);
          const targetInfo = itemToFileMap.get(cls.name);

          if (
            callerInfo &&
            targetInfo &&
            callerInfo.fileName !== targetInfo.fileName
          ) {
            if (!dependencies.has(callerInfo.fileName)) {
              dependencies.set(callerInfo.fileName, []);
            }

            const dependencyArray = dependencies.get(callerInfo.fileName);
            if (
              !dependencyArray.some(
                (dep) => dep.originalName === targetInfo.originalName
              )
            ) {
              dependencyArray.push(targetInfo);
            }
          }
        });
      }

      // Xử lý các references của methods trong class
      if (cls.methods) {
        cls.methods.forEach((method) => {
          const methodKey = `${cls.name}.${method.name}`;

          if (method.references && method.references.length > 0) {
            method.references.forEach((ref) => {
              if (!itemToFileMap.has(ref.name)) return;

              const callerInfo = itemToFileMap.get(ref.name);
              const targetInfo = itemToFileMap.get(methodKey);

              if (
                callerInfo &&
                targetInfo &&
                callerInfo.fileName !== targetInfo.fileName
              ) {
                if (!dependencies.has(callerInfo.fileName)) {
                  dependencies.set(callerInfo.fileName, []);
                }

                const dependencyArray = dependencies.get(callerInfo.fileName);
                // Nếu phụ thuộc vào method, thêm phụ thuộc vào class
                const classTargetInfo = itemToFileMap.get(cls.name);
                if (
                  !dependencyArray.some(
                    (dep) => dep.originalName === classTargetInfo.originalName
                  )
                ) {
                  dependencyArray.push(classTargetInfo);
                }
              }
            });
          }
        });
      }
    });

    return dependencies;
  }

  /**
   * Tạo import statements cho các phụ thuộc của file
   * @param {Array} dependencies - Mảng các phụ thuộc của file
   * @param {string} sourcePath - Đường dẫn tới file nguồn
   * @param {string} targetPath - Đường dẫn tới file đích
   * @returns {Array} Mảng các node ImportDeclaration
   */
  createImportStatementsForDependencies(dependencies, sourcePath, targetPath) {
    // Nhóm các import theo file path
    const importGroups = new Map();

    dependencies.forEach((dep) => {
      const sourceDir = path.dirname(sourcePath);
      const targetFilePath = path.join(sourceDir, dep.fileName);
      const relativePath = path.relative(
        path.dirname(targetPath),
        path.dirname(targetFilePath)
      );
      const importPath = `./${path
        .join(relativePath, path.basename(dep.fileName))
        .replace(/\\/g, "/")}`;

      if (!importGroups.has(importPath)) {
        importGroups.set(importPath, []);
      }

      importGroups.get(importPath).push({
        originalName: dep.newName,
        localName: dep.originalName,
      });
    });

    // Tạo các import statements
    const importStatements = [];
    for (const [importPath, specifiers] of importGroups.entries()) {
      const importSpecifiers = specifiers.map((spec) =>
        babelTypes.importSpecifier(
          babelTypes.identifier(spec.localName),
          babelTypes.identifier(spec.originalName)
        )
      );

      importStatements.push(
        babelTypes.importDeclaration(
          importSpecifiers,
          babelTypes.stringLiteral(importPath)
        )
      );
    }

    return importStatements;
  }

  splitFiles(extractConfig) {
    let me = this;
    const extractedItems = [];
    const notFound = [...extractConfig];
    if (extractConfig && extractConfig.length > 0) {
      // Phân tích file đầu tiên để lấy thông tin về các phụ thuộc
      const firstConfig = extractConfig[0];
      const code = fs.readFileSync(firstConfig.filePath, this._encodeType);
      const ast = this.parseSource(code);
      const analysis = this.analyzeFile(firstConfig.filePath);

      // Phân tích các phụ thuộc giữa các thành phần
      const dependencies = this.analyzeDependencies(analysis, extractConfig);

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

          // Thêm import statements cho các phụ thuộc của file này
          const importStatements = dependencies.has(path.basename(filePath))
            ? this.createImportStatementsForDependencies(
                dependencies.get(path.basename(filePath)),
                config.filePath,
                filePath
              )
            : [];

          // Tạo AST mới với import và export
          const newAst = babelTypes.program(
            [...importStatements, ...exportNodes],
            [],
            "module"
          );
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
    let outputPath = this.getFullPathForNewFile(currentConfig);
    const key = path.join(output.importCofig, output.fileName);
    if (!fileNodesMap.has(outputPath)) fileNodesMap.set(outputPath, []);

    // Đổi tên node trước khi thêm
    if (node.id) {
      node.id = babelTypes.identifier(newName);
    }

    fileNodesMap.get(outputPath).push({ node, name: newName });

    const relativePath = this.buildImportPathFile(key);
    extractedItems.push({
      name: newName,
      fileName: output.fileName,
      path: outputPath,
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

    const callArguments = originalMethodNode.static
      ? originalMethodNode.params.map((p) =>
          babelTypes.identifier(p.id ? p.id.name : p.name)
        )
      : [
          babelTypes.thisExpression(), // 'this' for instance methods
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
          if (typeof itemConfig === "object") {
            let checkIsReferenceClassMethod = itemConfig.methods
              ? itemConfig.methods.find(
                  (x) => x.references && x.references.length > 0
                )
              : false;
            if (!checkIsReferenceClassMethod) {
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
            } else if (itemConfig.methods) {
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

  // ================ VUE SUPPORT METHODS ================

  /**
   * Kiểm tra xem file có phải là Vue file không
   * @param {string} filePath - Đường dẫn file
   * @returns {boolean} true nếu là file .vue
   */
  isVueFile(filePath) {
    return path.extname(filePath) === ".vue";
  }

  /**
   * Extract script section từ Vue file
   * @param {string} vueContent - Nội dung file Vue
   * @returns {string|null} Script content hoặc null nếu không tìm thấy
   */
  extractScriptSection(vueContent) {
    const scriptMatch = vueContent.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    return scriptMatch ? scriptMatch[1] : null;
  }

  /**
   * Phân tích file Vue và extract Vue component methods
   * @param {string} filePath - Đường dẫn file Vue
   * @returns {Object} Analysis result containing Vue methods
   */
  analyzeVueFile(filePath) {
    const vueContent = fs.readFileSync(filePath, this._encodeType);
    const scriptSection = this.extractScriptSection(vueContent);

    if (!scriptSection) {
      throw new Error("No <script> section found in Vue file");
    }

    const ast = this.parseSource(scriptSection);
    const analysis = this.initNewAnalysisCode(filePath);

    // Tìm Vue component export và methods property
    const vueComponentNode = this.findVueComponentExport(ast);
    if (vueComponentNode) {
      const methodsProperty = this.findMethodsProperty(vueComponentNode);
      if (methodsProperty) {
        this.analyzeVueMethods(analysis, methodsProperty);
      }
    }

    this.caculateTotal(analysis);
    return analysis;
  }

  /**
   * Tìm Vue component export trong AST
   * @param {Object} ast - Abstract Syntax Tree
   * @returns {Object|null} Vue component object node
   */
  findVueComponentExport(ast) {
    let vueComponentNode = null;

    traverse(ast, {
      ExportDefaultDeclaration(path) {
        const declaration = path.node.declaration;
        if (babelTypes.isObjectExpression(declaration)) {
          vueComponentNode = declaration;
          path.stop(); // Dừng traverse khi tìm thấy
        }
      },
    });

    return vueComponentNode;
  }

  /**
   * Tìm methods property trong Vue component object
   * @param {Object} vueComponentNode - Vue component object node
   * @returns {Object|null} Methods property node
   */
  findMethodsProperty(vueComponentNode) {
    const methodsProperty = vueComponentNode.properties.find(
      (prop) =>
        babelTypes.isObjectProperty(prop) &&
        babelTypes.isIdentifier(prop.key) &&
        prop.key.name === "methods"
    );

    return methodsProperty ? methodsProperty.value : null;
  }

  /**
   * Phân tích các methods trong Vue component
   * @param {Object} analysis - Analysis object để lưu kết quả
   * @param {Object} methodsNode - Methods object node
   */
  analyzeVueMethods(analysis, methodsNode) {
    if (!babelTypes.isObjectExpression(methodsNode)) {
      return;
    }

    const me = this;
    methodsNode.properties.forEach((prop) => {
      if (
        babelTypes.isObjectProperty(prop) ||
        babelTypes.isObjectMethod(prop)
      ) {
        const methodName = prop.key.name;
        let methodFunction = null;

        if (babelTypes.isObjectMethod(prop)) {
          // method() { ... }
          methodFunction = prop;
        } else if (babelTypes.isObjectProperty(prop)) {
          // method: function() { ... } hoặc method: () => { ... }
          methodFunction = prop.value;
        }

        if (methodFunction) {
          analysis.functionDeclarations.push({
            name: methodName,
            totalLine: me.getTotalLineOfNode(methodFunction),
            startLine: methodFunction.loc
              ? methodFunction.loc.start.line
              : null,
            endLine: methodFunction.loc ? methodFunction.loc.end.line : null,
            references: [],
            isVueMethod: true, // Flag để đánh dấu là Vue method
          });
        }
      }
    });
  }

  /**
   * Tách Vue methods thành file riêng
   * @param {Array} extractConfig - Cấu hình tách file
   * @returns {Object} Kết quả tách file
   */
  splitVueFiles(extractConfig) {
    const result = { extractedItems: [], notFound: [...extractConfig] };

    if (!extractConfig || extractConfig.length === 0) {
      return result;
    }

    extractConfig.forEach((config) => {
      if (this.isVueFile(config.filePath)) {
        try {
          const vueResult = this.splitSingleVueFile(config);
          result.extractedItems.push(...vueResult.extractedItems);

          // Remove processed config from notFound
          const index = result.notFound.findIndex(
            (cfg) =>
              cfg.filePath === config.filePath &&
              cfg.splitedSubName === config.splitedSubName
          );
          if (index > -1) {
            result.notFound.splice(index, 1);
          }
        } catch (error) {
          console.error(
            `Error splitting Vue file ${config.filePath}:`,
            error.message
          );
        }
      }
    });

    return result;
  }

  /**
   * Tách một file Vue duy nhất
   * @param {Object} config - Cấu hình tách file
   * @returns {Object} Kết quả tách file
   */
  splitSingleVueFile(config) {
    const vueContent = fs.readFileSync(config.filePath, this._encodeType);
    const scriptSection = this.extractScriptSection(vueContent);

    if (!scriptSection) {
      throw new Error("No <script> section found in Vue file");
    }

    const ast = this.parseSource(scriptSection);
    const vueComponentNode = this.findVueComponentExport(ast);

    if (!vueComponentNode) {
      throw new Error("No Vue component export found");
    }

    const methodsProperty = this.findMethodsProperty(vueComponentNode);

    if (!methodsProperty) {
      throw new Error("No methods property found in Vue component");
    }

    // Extract methods và tạo file mới
    const extractedMethods = this.extractVueMethodsToSplit(
      methodsProperty,
      config.items
    );
    const methodsObjectFile = this.createVueMethodsFile(extractedMethods);

    // Ghi file methods
    const outputPath = this.getFullPathForNewFile(config);
    fs.writeFileSync(outputPath, methodsObjectFile, this._encodeType);

    // Cập nhật file Vue gốc
    this.updateVueFileWithImport(config, extractedMethods);

    return {
      extractedItems: extractedMethods.map((m) => ({
        name: m.name,
        fileName: config.splitedSubName,
        path: outputPath,
      })),
    };
  }

  /**
   * Extract các methods cần tách từ Vue methods object
   * @param {Object} methodsNode - Methods object node
   * @param {Array} itemsToExtract - Danh sách items cần tách
   * @returns {Array} Danh sách methods đã extract
   */
  extractVueMethodsToSplit(methodsNode, itemsToExtract) {
    const extractedMethods = [];
    const methodsToRemove = [];

    methodsNode.properties.forEach((prop, index) => {
      if (
        babelTypes.isObjectProperty(prop) ||
        babelTypes.isObjectMethod(prop)
      ) {
        const methodName = prop.key.name;

        // Kiểm tra xem method này có trong danh sách cần tách không
        if (itemsToExtract.includes(methodName)) {
          extractedMethods.push({
            name: methodName,
            node: prop,
          });
          methodsToRemove.push(index);
        }
      }
    });

    // Remove extracted methods từ original methods object
    methodsToRemove.reverse().forEach((index) => {
      methodsNode.properties.splice(index, 1);
    });

    return extractedMethods;
  }

  /**
   * Tạo file chứa Vue methods đã tách
   * @param {Array} extractedMethods - Danh sách methods đã extract
   * @returns {string} Nội dung file methods
   */
  createVueMethodsFile(extractedMethods) {
    const methodProperties = extractedMethods.map(({ name, node }) => {
      // Convert các loại method về ObjectMethod để đảm bảo this binding
      if (babelTypes.isObjectProperty(node)) {
        // method: function() { ... } -> method() { ... }
        if (babelTypes.isFunctionExpression(node.value)) {
          return babelTypes.objectMethod(
            "method",
            babelTypes.identifier(name),
            node.value.params,
            node.value.body,
            false, // computed
            false, // generator
            node.value.async || false
          );
        }
        // method: () => { ... } -> method() { ... } (convert arrow to regular function)
        else if (babelTypes.isArrowFunctionExpression(node.value)) {
          const body = babelTypes.isBlockStatement(node.value.body)
            ? node.value.body
            : babelTypes.blockStatement([
                babelTypes.returnStatement(node.value.body),
              ]);

          return babelTypes.objectMethod(
            "method",
            babelTypes.identifier(name),
            node.value.params,
            body,
            false, // computed
            false, // generator
            node.value.async || false
          );
        }
      }
      // Nếu đã là ObjectMethod thì giữ nguyên
      return node;
    });

    // Tạo object chứa các methods
    const methodsObject = babelTypes.objectExpression(methodProperties);

    // Tạo export default
    const exportDefault = babelTypes.exportDefaultDeclaration(methodsObject);

    // Tạo AST và generate code
    const ast = babelTypes.program([exportDefault], [], "module");
    const code = generate(ast, { comments: true }).code;

    return code;
  }

  /**
   * Cập nhật file Vue gốc với import và spread methods
   * @param {Object} config - Cấu hình tách file
   * @param {Array} extractedMethods - Danh sách methods đã tách
   */
  updateVueFileWithImport(config, extractedMethods) {
    const vueContent = fs.readFileSync(config.filePath, this._encodeType);
    const scriptSection = this.extractScriptSection(vueContent);
    const ast = this.parseSource(scriptSection);

    // Tạo import name từ file name (remove extension và convert to camelCase)
    let importName = path.basename(
      config.splitedSubName,
      path.extname(config.splitedSubName)
    );
    // Convert dấu gạch ngang thành camelCase
    importName = importName.replace(/-([a-z])/g, (match, letter) =>
      letter.toUpperCase()
    );

    // Thêm import statement
    const importStatement = babelTypes.importDeclaration(
      [babelTypes.importDefaultSpecifier(babelTypes.identifier(importName))],
      babelTypes.stringLiteral(`./${config.splitedSubName}`)
    );

    // Thêm import vào đầu file
    ast.program.body.unshift(importStatement);

    // Tìm Vue component và xử lý methods
    traverse(ast, {
      ExportDefaultDeclaration(path) {
        const declaration = path.node.declaration;
        if (babelTypes.isObjectExpression(declaration)) {
          const methodsProperty = declaration.properties.find(
            (prop) =>
              babelTypes.isObjectProperty(prop) &&
              babelTypes.isIdentifier(prop.key) &&
              prop.key.name === "methods"
          );

          if (
            methodsProperty &&
            babelTypes.isObjectExpression(methodsProperty.value)
          ) {
            // Xóa các methods đã tách khỏi file gốc
            const extractedMethodNames = extractedMethods.map((m) => m.name);
            methodsProperty.value.properties =
              methodsProperty.value.properties.filter((prop) => {
                if (
                  babelTypes.isObjectProperty(prop) ||
                  babelTypes.isObjectMethod(prop)
                ) {
                  const methodName = prop.key.name;
                  return !extractedMethodNames.includes(methodName);
                }
                return true; // Giữ lại các properties khác (spread, etc.)
              });

            // Thêm spread import vào đầu methods object
            const spreadElement = babelTypes.spreadElement(
              babelTypes.identifier(importName)
            );
            methodsProperty.value.properties.unshift(spreadElement);
          }
        }
      },
    });

    // Generate updated script
    const updatedScript = generate(ast, { comments: true }).code;

    // Replace script section trong Vue file
    const updatedVueContent = vueContent.replace(
      /<script[^>]*>[\s\S]*?<\/script>/,
      `<script>\n${updatedScript}\n</script>`
    );

    fs.writeFileSync(config.filePath, updatedVueContent, this._encodeType);
  }

  /**
   * Entry point cho việc split files (hỗ trợ cả JS và Vue)
   * @param {Array} extractConfig - Cấu hình tách file
   * @returns {Object} Kết quả tách file
   */
  splitFilesUniversal(extractConfig) {
    if (!extractConfig || extractConfig.length === 0) {
      return { extractedItems: [], notFound: [] };
    }

    // Phân loại config theo loại file
    const jsConfigs = extractConfig.filter(
      (config) => !this.isVueFile(config.filePath)
    );
    const vueConfigs = extractConfig.filter((config) =>
      this.isVueFile(config.filePath)
    );

    // Process JS files
    const jsResult =
      jsConfigs.length > 0
        ? this.splitFiles(jsConfigs)
        : { extractedItems: [], notFound: [] };

    // Process Vue files
    const vueResult =
      vueConfigs.length > 0
        ? this.splitVueFiles(vueConfigs)
        : { extractedItems: [], notFound: [] };

    // Combine results
    return {
      extractedItems: [...jsResult.extractedItems, ...vueResult.extractedItems],
      notFound: [...jsResult.notFound, ...vueResult.notFound],
    };
  }
}

export default new RefactorJS();
