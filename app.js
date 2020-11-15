const https = require('https');
const path = require('path');
const fs = require("fs");
const cheerio = require('cheerio');
const glob = require('glob');
const request = require('request');
const imghdr = require('imghdr');

const log4js = require("log4js");
const logger = log4js.getLogger();
logger.level = "info";

// 定义当前目录
APP_PATH = __dirname
// 定义 图片目录
IMG_PATH = path.join(APP_PATH, "../fuliimages1")

logger.info("----------当前运行路径: " + APP_PATH + " ----------")
logger.info("----------图片存储路径: " + IMG_PATH + " ----------")

main()

// 主函数
function main() {
    for (let index = 1; index < 8; index++) {
        get_list(index)
    }
    logger.info("启动成功,程序每小时运行一次")
    setTimeout(() => {
        main(true)
    }, 60 * 60 * 1000);
}

// 获取 列表页
function get_list(page_index) {
    let url = 'https://fuliba2020.net/category/flhz'
    if (page_index !== 1) {
        url = url + "/page/" + page_index
    }
    _request(url, (html) => {
        logger.info("列表页请求成功:" + url)
        const $ = cheerio.load(html);
        $("h2 a").map((index, el) => {
            // 准备 参数
            let content_title = el.attribs.title
            let page_url = el.attribs.href
            // 测试查看参数
            logger.debug("content_title:" + content_title)
            logger.debug("page_url:" + page_url)

            // 开始调用 get_page
            get_page(page_url, content_title)
        })
    }, () => {
        logger.info("列表页请求失败:" + url)
    })
}

// 获取 内容页
function get_page(page_url, page_title) {
    _request(page_url, (html) => {
        logger.debug("----内容页请求成功:" + page_url)
        const $ = cheerio.load(html);
        $(".article-paging a").map((index, el) => {
            // 准备 参数
            let content_url = el.attribs.href
            // 开始调用 get_page
            get_content(content_url, page_title, $(el).text())
        })
    }, () => {
        logger.info("----内容页请求失败:" + page_url)
    })
}

// 获取 内容 分页
function get_content(content_url, content_title, content_index) {
    _request(content_url, (html) => {
        logger.debug("--------详情页请求成功:" + content_index + ":" + content_title)
        const $ = cheerio.load(html);
        let tag = content_title.match('(.*?)福利汇总第(.*?)期')
        $(".article-content img").map((index, el) => {
            // 准备 参数
            let img_src = el.attribs.src
            if (!img_src) {
                logger.error("src为空:" + content_index + "-" + index + ":" + content_title)
            } else {
                let img_path = path.join(IMG_PATH, tag[1], tag[2], content_index, path.basename(img_src))

                // 测试查看参数
                logger.debug("img_src:" + img_src)
                logger.debug("img_path:" + img_path)

                // 开始调用 save_img
                save_img(img_src, img_path)
            }
        })
    }, () => {
        logger.info("--------详情页请求失败:" + content_url)
    })
}

// 保存图片
function save_img(img_src, img_path) {
    logger.debug("--------开始下载图片:" + img_src)

    // 检测文件已近下载过
    if (fs.existsSync(img_path)) {
        logger.debug("--------图片已下载过:" + img_src)
        logger.debug("--------图片保存位置:" + img_path)
        return
    }
    // 检测无后缀名文件已经下载过
    if (glob.sync(img_path + "*").length > 0) {  // 如果图片是没有后缀名的
        logger.debug("--------图片已下载过:" + img_src)
        logger.debug("--------图片保存位置:" + img_path)
        return
    }
    // img_path = path.join(APP_PATH, img_path)
    let img_folder = path.dirname(img_path)
    // 判断目录是否存在
    if (!fs.existsSync(img_folder)) {
        try {
            _mkdirsSync(img_folder)
        } catch (e) {
            logger.error('--------文件夹创建失败:' + "\t" + img_path)
            logger.error(e)
            return
        }
    }

    //开始请求文件
    _request(img_src, (res) => {
        // 如果文件名没有后缀
        if (!path.extname(img_src)) {
            try {
                let exts = imghdr.what(res)
            } catch (e) {
                logger.error("--------图片解析失败:" + img_src)
                logger.error("--------      地址:" + img_path)
                return
            }
            img_path = img_path + '.' + exts[0]
        }

        fs.writeFile(img_path, res, err => {
            if (!err) {
                logger.debug('--------图片保存成功:' + img_src)
            } else {
                logger.error("--------图片保存失败:" + img_src)
                logger.error("--------      地址:" + img_path)
            }
        })

    }, () => {
        logger.error("--------图片请求失败:" + img_src)
        logger.error("--------      地址:" + img_path)
    })


}

// 请求图片
function _request(url, callback, errError) {
    request(url, {
            encoding: null,
            headers: {/*设置请求头*/
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36"
            }
        },
        function (error, response, body) {
            if (!error && response.statusCode === 200) {
                callback(body)
            } else {
                errError ? errError() : null
            }
        }
    );
}

// 请求网页
function _request1(url, callback, isImg = false) {
    https.get(url, function (res) {
        if (isImg) {
            res.setEncoding("binary");
        }
        var html = ''
        // 绑定data事件 回调函数 累加html片段
        res.on('data', function (data) {
            html += data
        });
        res.on('end', function () {
            callback(html)
        });
    }).on('error', function () {
        logger.info("内容请求失败:" + url)
    });
}

function _mkdirsSync(dirname) {
    if (fs.existsSync(dirname)) {
        return true;
    } else {
        if (_mkdirsSync(path.dirname(dirname))) {
            fs.mkdirSync(dirname);
            return true;
        }
    }
}