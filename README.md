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
    "filePath": "./input/test.js",
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
    "outputDir": "./output/",
    "splitedSubName": "test-method-one"
  },
  {
    "filePath": "./input/test.js",
    "items": ["calculateSum", "multiplyNumbers", "divideNumbers"],
    "outputDir": "./output/",
    "splitedSubName": "test-method-two"
  },
  {
    "filePath": "./input/test.js",
    "items": [{ "name": "Telephone", "newName": "Phone" }],
    "outputDir": "./output/",
    "splitedSubName": "test-method-three"
  }
]



```

Trong đó:

"filePath" : path tới file source

"items" : danh sách các method, class, variable của file gốc sẽ được mang sang file mới

trong items sẽ là mảng các tên bằng string, nếu nhiều hàm trùng tên nằm trong 1 file thì tên sẽ được viết dạng object với "name" là tên gốc, "newName" là tên mới sau khi export import

trường hợp muốn tách method trong class thì phải khai báo rõ object gồm "class" là tên class và "methods" là mảng các method cần tách

"outputDir" : thư mục của file đã tách

"splitedSubName" : sub tên của file đã tách, có thể theo nghiệp vụ mong muốn đặt riêng
