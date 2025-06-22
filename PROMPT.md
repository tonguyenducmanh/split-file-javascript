Yêu cầu phân nhóm phương thức
Mục tiêu
Phân nhóm các phương thức theo chức năng
Tổng kích thước các nhóm không chênh lệch nhau quá nhiều (khi cùng 1 phương thức có thể chia vào nhiều nhóm thì ưu tiên nhóm có tổng ký tự ít hơn)
Nếu số dòng vượt quá 500 thì mới tạo nhóm mới
Số nhóm tối đa là 5 nhóm
Danh sách phương thức được lưu theo từng file như bên dưới:

Yêu cầu đặc biệt
Bạn hãy đảm bảo tất cả các phương thức đều được phân nhóm và không có phương thức nào được phân vào nhiều nhóm, trường hợp không phân được vào nhóm phù hợp thì hãy chia vào nhóm Other
Nếu là class thì ưu tiên đưa class ra file mới

format trả về phải theo dạng như bên dưới:

```
[
  {
    "filePath": //full path tới file source,
    "items": [
        // danh sách các method, class, variable của file gốc sẽ được mang sang file mới
        // trong items sẽ là mảng các tên bằng string, nếu nhiều hàm trùng tên nằm trong 1 file thì tên sẽ được viết dạng object với "name" là tên gốc, "newName" là tên mới sau khi export import
        // trường hợp muốn tách method trong class thì phải khai báo rõ object gồm "class" là tên class và "methods" là mảng các method cần tách
    ],
    "splitedSubName": // sub tên của file đã tách => khi tách xong sẽ nằm cùng cấp với file gốc, đặt tên bằng tiếng anh theo ngữ nghĩa chung của các hàm trong nhóm, tên file phải có tiền tố là tên file gốc
  }
]
```

ví dụ

```
[
  {
    "filePath": "D:/code/demo.js",
    "items": [
      {
        "class": "ValidatorCURD",
        "methods": [
          { "name": "validateInsert", "newName": "Insert" },
          { "name": "validateDelete", "newName": "Detete" }
        ]
      },
      { "name": "validateData", "newName": "DateValidate" },
      "validateMoney"
    ],
    "splitedSubName": "demo_validate.js"
  },
  {
    "filePath": "D:/code/demo.js",
    "items": [{ "name": "AuthLogin", "newName": "Login" }],
    "splitedSubName": "demo_user_login.js"
  }
]


```
