## Tool tách nhỏ file js

## file source refactor code

[Refactor.js](Refactor.js)

trong file Refactor.js có 2 hàm quan trọng là analyzeFile() dùng để thống kê xem file nguồn có những method, class, variable nào, số dòng của từng method, class

hàm splitFile() được dùng để chia nhỏ file theo config của người dùng truyền vào, có thể là 1 biến hoặc gọi từ file json

## file demo việc tách file theo config có sẵn

[demo](index.js)

## cấu trúc chung của file config json

```

[
  {
    "filePath": "D:/code/my code/split-file-javascript/demo/test.js",
    "items": [
      {
        "class": "Calculator",
        "methods": [
          { "name": "add", "newName": "addNumbers" },
          { "name": "subtract", "newName": "subtractNumbers" }
        ]
      },
      { "name": "MathUtils", "newName": "ExtendedMath" },
      { "name": "greetUser", "newName": "sayHello" },
      "performCalculations"
    ],
    "splitedSubName": "test_method_one.js"
  },
  {
    "filePath": "D:/code/my code/split-file-javascript/demo/test.js",
    "items": ["calculateSum", "multiplyNumbers", "divideNumbers"],
    "splitedSubName": "test_method_two.js"
  },
  {
    "filePath": "D:/code/my code/split-file-javascript/demo/test.js",
    "items": [{ "name": "Telephone", "newName": "Phone" }],
    "splitedSubName": "test_method_three.js"
  }
]


```

Trong đó:

"filePath" : full path tới file source

"items" : danh sách các method, class, variable của file gốc sẽ được mang sang file mới

trong items sẽ là mảng các tên bằng string, nếu nhiều hàm trùng tên nằm trong 1 file thì tên sẽ được viết dạng object với "name" là tên gốc, "newName" là tên mới sau khi export import

trường hợp muốn tách method trong class thì phải khai báo rõ object gồm "class" là tên class và "methods" là mảng các method cần tách

"splitedSubName" : sub tên của file đã tách => khi tách xong sẽ nằm cùng cấp với file gốc

## cấu trúc của kết quả sau khi phân tích như bên dưới, copy vào cho chat gpt phân tách thành mẫu bên trên

```
{
  filePath: "D:\\code\\my code\\split-file-javascript\\demo\\test.js",
  functionDeclarations: [
    {
      name: "greetUser",
      line: 3,
    },
    {
      name: "calculateSum",
      line: 7,
    },
  ],
  classDeclarations: [
    {
      name: "Telephone",
      line: 22,
      methods: [
        {
          name: "add",
          line: 27,
        },
      ],
    },
    {
      name: "Calculator",
      line: 44,
      methods: [
        {
          name: "getHistory",
          line: 61,
        },
      ],
    }
  ],
  totalFunctions: 6,
  totalClasses: 3,
}
```
