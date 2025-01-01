
# 介绍
自己用的小工具，clone 到本地，运行在本地，数据存储在本地文件夹
鼠标点击放烟火，哈哈，新增特效
```
安装依赖
npm install 
运行
npm start 
```
![](https://raw.githubusercontent.com/jhfnetboy/MarkDownImg/main/img/202501011407268.png)

我的习惯是访问 http://localhost:3086/index.html，pin 在 chrome 日常使用

## 链接管理

给开发者用的简单目标管理工具和日程 link 管理工具
运行在本地，数据存储在本地文件夹
简单的链接管理，可以添加链接，删除链接，编辑链接，**不要添加太多**，日常用的即可
1. 添加链接：name, url, tag
2. 删除链接
3. 编辑链接
![](https://raw.githubusercontent.com/jhfnetboy/MarkDownImg/main/img/202501011323757.png)
## 目标管理

1. 添加年度目标
2. 添加月度目标，并选择一个年度目标作为父目标
3. 添加周目标，并选择一个月度目标作为父目标
4. 更改任何目标的颜色
5. 编辑目标内容 (好像有点问题)
6. 删除目标
7. 靠继承颜色来一眼看到关联
![](https://raw.githubusercontent.com/jhfnetboy/MarkDownImg/main/img/202501011324904.png)


# 历史版本开发记录：local-http
local http static server, for some quick links

## v0.1
1. 我需要一个本地 http 静态服务器，可以快速通过页面，访问一些链接
2. 页面以表格方式展示链接：三列，分别是 name, url, 备注
3. 这个页面需要有一个输入的 input，格式是 name::url 来添加新链接
4. 原有链接可以进行修改命名和删除
5. 页面需要有一个按钮，点击后，将表格内容保存到本地文件
6. 页面需要有一个按钮，点击后，将表格内容从本地文件加载到页面
7. 以 csv 形式存储这些内容，可以加载多个文件，分段显示即可
8. 自动加载 default.csv，并显示
9. 使用 nodejs 开发这个页面，然后 http-server 启动 http 服务，常驻后台

## v0.1 Implementation

### Server Setup
1. Create a basic Node.js server using Express
2. Serve static files from public directory
3. Add endpoints for:
   - GET /links - Get all links from CSV files
   - POST /links - Save new link
   - PUT /links/:id - Update existing link
   - DELETE /links/:id - Delete link
   - POST /save - Save links to CSV file
   - GET /load - Load links from CSV file

### Frontend Implementation
1. Create HTML table with columns:
   - Name
   - URL  
   - Notes
   - Actions (Edit/Delete buttons)

2. Add input field for new links:
   ```html
   <input type="text" placeholder="name::url" id="newLink">
   <button onclick="addLink()">Add</button>
   ```

3. Add save/load buttons:
   ```html
   <button onclick="saveLinks()">Save to File</button>
   <button onclick="loadLinks()">Load from File</button>
   ```

4. JavaScript functionality:
   - Parse input in format "name::url"
   - CRUD operations for links using fetch API
   - Auto-load default.csv on page load
   - Save/load links to/from CSV files
   - Update table UI dynamically

### File Structure
name::url::notes

## How to use
1. clone this repo
2. run `npm install`
3. run `node server.js`
4. open `http://localhost:3000` in your browser
5. add new links to the table
6. click save to save the table to `data/default.csv`
7. click load to load the table from `data/default.csv`
8. auto load `data/default.csv` on page load
9. DONT FORGET TO MODIFY .gitignore to ignore the data directory!!!

## Author
jhfnetboy@gmail.com::spider::spider

