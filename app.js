const axios = require('axios');
const path = require('path');
const fs = require("fs");
const cheerio = require('cheerio');
const glob = require('glob');
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


const url = 'https://fuliba2020.net/category/flhz'


// 主函数
function main() {
    function i_next(index) {
        if (index < 8) {
            get_list(index, () => {
                i_next(index+1)
            })
        }else{
            logger.info("请求完成,一小时后重试")
            setTimeout(() => {i_next(1)}, 60 * 60 * 1000);
        }
    }
    i_next(1)
}

// 获取 列表页
function get_list(list_index, _resolve) {
    let list_url = url + (list_index > 1 ? ("/page/" + list_index) : "")
    logger.info("列表页请求成功:" + list_url)
    _request(list_url,
        (html) => {
            const $ = cheerio.load(html);
            let els = $("h2 a")
            
            function i_next(index) {
                if (index < els.length) {
                    let el = els[index]
                    // 准备 参数
                    let content_title = el.attribs.title
                    let page_url = el.attribs.href
                    // 测试查看参数
                    logger.debug("content_title:" + content_title)
                    logger.debug("page_url:" + page_url)
                    // 开始调用 get_page
                    get_page(page_url, content_title, () => {
                        i_next(index+1)
                    })
                } else {
                    _resolve()
                }
            }
            
            i_next(0)
            
        },
        () => {
            logger.info("列表页请求失败:" + list_url)
            _resolve()
        })
}

// 获取 内容页
function get_page(page_url, page_title, _resolve) {
    logger.info("--内容页请求成功:" + page_url)
    _request(page_url,
        (html) => {
            const $ = cheerio.load(html);
            let els = $(".article-paging a")
            
            function i_next(index) {
                if (index < els.length) {
                    let el = els[index]
                    // 准备 参数
                    let content_url = el.attribs.href
                    // 开始调用 get_page
                    get_content(content_url, page_title, $(el).text(), () => {
                        i_next(index+1)
                    })
                } else {
                    _resolve()
                }
            }
            
            i_next(0)
        },
        () => {
            logger.error("--内容页请求失败:" + page_url)
            _resolve()
        })
}

// 获取 内容 分页
function get_content(content_url, content_title, content_index, _resolve) {
    logger.info("----详情页请求成功:" + content_index + ":" + content_title)
    _request(content_url,
        (html) => {
            const $ = cheerio.load(html);
            let tag = content_title.match('(.*?)福利汇总第(.*?)期')
            let els = $(".article-content img")
    
            function i_next(index) {
                if (index < els.length) {
                    let el = els[index]
                    // 准备 参数
                    let img_src = el.attribs.src
                    if (img_src) {
                        let img_path = path.join(IMG_PATH, tag[1], tag[2], content_index, path.basename(img_src))
                        // 测试查看参数
                        logger.debug("img_src:" + img_src)
                        logger.debug("img_path:" + img_path)
                        // 开始调用 save_img
                        save_img(img_src, img_path,() => {
                            i_next(index+1)
                        })
                    } else {
                        logger.error("src为空:" + content_index + "-" + index + ":" + content_title)
                        i_next(index+1)
                    }
                } else {
                    _resolve()
                }
            }
    
            i_next(0)
        },
        () => {
            logger.error("----详情页请求失败:" + content_url)
            _resolve()
        })
}

// 保存图片
function save_img(img_src, img_path, _resolve) {
    logger.debug("------开始下载图片:" + img_src)
    // 检测文件已近下载过
    if (fs.existsSync(img_path)) {
        logger.debug("--------图片已下载过:" + img_src)
        logger.debug("--------图片保存位置:" + img_path)
        _resolve()
        return
    }
    // 检测无后缀名文件已经下载过
    if (glob.sync(img_path + "*").length > 0) {  // 如果图片是没有后缀名的
        logger.debug("--------图片已下载过:" + img_src)
        logger.debug("--------图片保存位置:" + img_path)
        _resolve()
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
            _resolve()
            return
        }
    }
    
    //开始请求图片
    _request(img_src,
        (res) => {
            // 如果文件名没有后缀
            if (!path.extname(img_src)) {
                try {
                    let exts = imghdr.what(res)
                } catch (e) {
                    logger.error("--------图片解析失败:" + img_src)
                    logger.error("              地址:" + img_path)
                    _resolve()
                    return
                }
                img_path = img_path + '.' + exts[0]
            }
            
            fs.writeFile(img_path, res, "binary", err => {
                if (!err) {
                    logger.info('--------图片保存成功:' + img_src)
                    logger.info("              地址:" + img_path)
                    _resolve()
                } else {
                    logger.error("--------图片保存失败:" + img_src)
                    logger.error("              地址:" + img_path)
                    _resolve()
                }
            })
            
        },
        () => {
            logger.error("--------图片请求失败:" + img_src)
            logger.error("              地址:" + img_path)
            _resolve()
        }, true)
    
    
}

// 请求图片
function _request(url, callback, errError) {
    axios.get(url,
        {
            timeout: 10 * 60 * 1000,
            headers: {/*设置请求头*/
                "user-agent": " Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36",
            },
            responseType: 'arraybuffer'
        }
    ).then(function (res) {
        if (res.status === 200) {
            callback(res.data)
        } else {
            errError ? errError() : null
        }
    }).catch(function (error) {
        errError ? errError(error) : null
    }).then(function () {
        // always executed
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


main()

/*
_request('https://tva1.sinaimg.cn/large/007asALTgy1gl8lgxao5qg305p0a5qv5.gif', res => {
    console.log(res)
}, err => {
    console.log(err)
})
*/

// save_img('https://tva1.sinaimg.cn/large/007asALTgy1gl8lgxao5qg305p0a5qv5.gif', path.join('d:', '111', '007asALTgy1gl8lgxao5qg305p0a5qv5.gif'), ()=>{})

// [
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lgtgnscg30a805f4qp.gif",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lgu0zgxg306a0a3x6q.gif",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lguddnyg306u086u0x.gif",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lgvmh5rg30850a6npj.gif",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lgw1mbog305p0a5b29.gif",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lgwfnepg305p0a5hdt.gif",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lgwt5bdg305p0a57wh.gif",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lgxao5qg305p0a5qv5.gif",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lgxw2usg30a506tb2a.gif",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lgyibe8g30a406shdu.gif",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lgyqqlmg30a306sk7f.gif",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lgzioreg30a405oqv6.gif",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm2hze7j30xc0p0k43.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm3e7ynj30m80xcn94.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm3l666j30xc0m810e.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm3unztj30m80etzp2.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm41q0rj30xc0m8alg.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm49eo0j30m80xcwth.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm4gz5uj30m80etwm2.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm4ncnvj30m80xcgzh.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm4u5k0j30m80xcqe0.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm55vvgj30xc0m8qay.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm5bo4oj30xc0iq78k.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm5nllij30m80xc7fh.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm5wfqyj30m80xcakv.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm650jnj30xc0m87cc.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm6evd2j30m80xcqds.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm6o0z4j30xc0m87bc.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm6wy03j30xc0m87dq.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm74j4aj30xc0m8gw0.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm7df54j30m80xc1av.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm7mpmgj30m80xc137.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm7wupvj30xc0m8n65.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm83uo9j30m80xcgx2.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm8bqpej30xc0m8dn2.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm8jpn5j30m80xck24.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm8t21pj30m80xctn5.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm95szzj30xc0m813w.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm9dpquj30xc0m8481.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm9m54aj30m80u249r.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lm9ugcaj30xc0kn49c.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lma3kahj30m80rsnep.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lmaehafj30m80r87fl.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lmamvkaj30m80tmdsu.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lmavlgcj30m80newob.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lmb4gaqj30m80rsqel.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lmbgczcj30m80xbtkf.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lmbr5haj30m813gtoq.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lmceelfj30m813iaz3.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lmcq9rkj30m813i7nw.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lmcyz6nj30xc0m847x.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lmdcupfj30xc0m810i.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lmdlte9j30xc0m8gun.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lmdur7qj30xc0m8gww.jpg",
//     "https://tva1.sinaimg.cn/large/007asALTgy1gl8lme926aj30xc0induw.jpg",
// ].map((item, i) => {
//     save_img(item, path.join('d:', '111', path.basename(item)), ()=>{})
// })