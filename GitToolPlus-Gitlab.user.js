// ==UserScript==
// @icon         http://pic04.babytreeimg.com/img/common/136x136.png
// @name         GitToolPlus-Gitlab
// @namespace    http://www.babytree.com/
// @version      4.10.5.1
// @updateURL    https://ghproxy.com/https://raw.githubusercontent.com/yxwmok/tool/main/GitToolPlus-Gitlab.user.js
// @downloadURL  https://ghproxy.com/https://raw.githubusercontent.com/yxwmok/tool/main/GitToolPlus-Gitlab.user.js
// @description  Plus gitool!
// @author       caoxinyu
// @run-at       document-body
// @include      http://gitool.plt.babytree-inc.com/*
// @grant        GM_info
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_notification
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      gitlab.babytree-inc.com
// @connect      oapi.dingtalk.com
// @connect      alljc.cc
// @connect      ghproxy.com
// ==/UserScript==
(function () {
    'use strict';

    var UPDATE_JS_TOKEN = 'update_js_token';
    var ROLLBACK_ONLINE_TOKEN = 'rollback_online_token';
    var NOTICE_LIST = 'new_notice_list';

    var ADDED_TASK = 'added';
    var PRE_RELEASE_TASK = 'pre_release';
    var START_PRE_TEST_TASK = 'start_pre_test';
    var PRE_PASS_TASK = 'pre_pass';
    var PRE_FAILED_TASK = 'pre_failed';
    var START_TEST_TASK = 'start_test';
    var TEST_FAILED_TASK = 'test_failed';
    var TEST_PASS_TASK = 'test_pass';
    var ONLINE_TASK = 'online';
    var CLOSED_TASK = 'closed';

    // 获取url类型
    var url_arr = window.location.pathname.split('/'),
        type = url_arr.length > 1 ? url_arr[1] : '',
        status = url_arr.length > 2 ? url_arr[2] : '',
        allowUrlArr = {
            '/gitool/my_task_list': [
                {
                    'q': 'doing'
                }
            ],
            '/gitool/new_task': true,
            '/gitool/edit_task': true,
            '/dockertool/new_task': true,
            '/dockertool/edit_task': true,
            '/dockertool/task_detail': true,
            '/gitool/task_detail': true,
            '/sql/new_task': true
        },
        userName = '',
        dingRobotTokenUrl = 'https://ghproxy.com/https://raw.githubusercontent.com/yxwmok/tool/main/dingrobot.json',
        eventUrl = 'https://alljc.cc/index/gitool/event',
        getTaskListUrl = 'https://alljc.cc/index/gitool/lists',
        dingTokenList = {},
        dingUrl = 'https://oapi.dingtalk.com/robot/send?access_token=',
        // gitlab地址
        gitlabConfig = {
            gitlabProjectListKey: 'gitlab_project_list_key',
            gitlabTokenKey: 'gitlab_token',
            hotProjectKey: 'hot_project_v1' + type,
            versionKey: 'version_v1',
            baseHost: 'http://gitlab.babytree-inc.com',
            uris: {
                projectInfo: '/api/v4/projects/%project%?private_token=',
                projectList: '/api/v4/projects?min_access_level=30&page=%page%&per_page=100&private_token=',
                branchList: '/api/v4/projects/%project%/repository/branches?per_page=100&private_token=',
                queryChange: '/api/v4/projects/%project%/repository/commits?ref_name=%branch%&private_token=',
                createBranch: '/api/v4/projects/%project%/repository/branches?private_token=',
                deleteBranch: '/api/v4/projects/%project%/repository/branches/%branch%?private_token=',
                createMergeRequest: '/api/v4/projects/%project%/merge_requests?private_token=',
                updateMergeRequest: '/api/v4/projects/%project%/merge_requests/%merge_request%?private_token=',
                getTagList: '/api/v4/projects/%project%/repository/tags?order_by=updated&per_page=1&private_token=',
                addTag: '/api/v4/projects/%project%/repository/tags?private_token=',
                review: '/pregnancy-backend/%project_name%/-/compare/%old_branch%...%new_branch%?from_project_id=%project%&view=parallel'
            }
        },
        // gitlab token
        token = GM_getValue(gitlabConfig.gitlabTokenKey, ''),
        // 受保护分支后缀
        protectedBranches = '_onl_mst',
        // 有权限的库列表
        projectList = {},
        // 代码库ID
        project_id = 0,
        // 常用代码库
        hotProjectList = GM_getValue(gitlabConfig.hotProjectKey, []),
        // 默认html
        branchHtml = $('#form .form-group:eq(1) .col-lg-7').html(),
        branchDockerHtml = $('#form .form-group:eq(1) .col-lg-5:eq(0)').html(),
        // commitIdHtml = $('#form .form-group:eq(2) .col-lg-7').html(),
        _branch = '',
        review,
        _branch_arr = [];

    // 获取钉钉机器人token
    getDingRobotToken(function (res) {
        dingTokenList = res;

        init();
    });

    function init() {
        // 显示图标
        var icon = $('<div></div>').css({
            position: 'fixed',
            width: '50px',
            top: '19%',
            right: '0'
        });
        icon.append($('<img>').attr('src', 'http://pic04.babytreeimg.com/img/common/136x136.png').css({ width: '100%', cursor: 'pointer' }));
        icon.append($('<span>').text('设置').addClass('label label-success').css({ cursor: 'pointer', margin: 'auto', display: 'table' }));
        icon.append($('<span>').text(GM_info.script.version).css({ margin: 'auto', display: 'table' }));
        icon.find('img').click(function () {
            GM_openInTab('http://space.babytree-inc.com/display/salesproduct/GitToolPlus-Gitlab');
        });
        icon.find('span.label-success').click(function () {
            setToken();
        });
        $('#wrapper').append(icon);

        // 取用户名
        if ($('.dropdown-toggle').text().split('-').length > 1) {
            userName = $('.dropdown-toggle').text().split('-')[0].trim();
        }

        // console.log('userName=' + userName);
        // console.log('token=' + token);
        // console.log('type=' + type);
        // console.log('status=' + status);

        // 版本更新通知
        var oldVersion = GM_getValue(gitlabConfig.versionKey, '0.0.0');
        // if (GM_info.script.version != oldVersion) {
        if (versionStringCompare(GM_info.script.version, oldVersion) > 0) {
            // 发送钉钉消息
            sendDing(UPDATE_JS_TOKEN, userName, '更新了插件，当前版本：' + GM_info.script.version, function () {});

            // 循环提示
            var _notice = '';
            for(var _i in dingTokenList[NOTICE_LIST]) {
                var _info = dingTokenList[NOTICE_LIST][_i];
                // 过滤旧版本
                if (versionStringCompare(oldVersion, _info.version) >= 0) {// 4.9.9  4.9.1 1
                    continue;
                }

                // 过滤新版本
                if (versionStringCompare(GM_info.script.version, _info.version) < 0) {// 4.9.12  4.9.10 1
                    continue;
                }

                _notice += _info.content + "\n\n";
            }

            if (_notice.trim() != '') {
                if ($('.fade').length > 0) {
                    $('.fade:eq(0) .modal-title').text('插件更新');
                    $('.fade:eq(0) .modal-body').html(_notice.replaceAll('\n', '<br/>'));
                    $('.fade:eq(0)').modal({
                        keyboard: false,
                        backdrop: 'static'
                    });
                } else {
                    alert(_notice.substr(0, _notice.length - 4));
                }
            }

            GM_setValue(gitlabConfig.versionKey, GM_info.script.version);
        }

        // 设置TOKEN
        if (token == '' || token == null || token == '3fTdFZiJxsDGPF5bDQpG') {
            var _token = '';
            if (confirm('你是测试人员吗？')) {
                _token = 'pXwcecyenbZcq1Rs8zqH';
                GM_setValue(gitlabConfig.gitlabTokenKey, _token);
            } else {
                _token = setToken();
                if (!_token) {
                    alert('未设置将不执行此插件');
                    return;
                }
            }

            token = _token;
        }

        var timer = new Date();
        var dateStr = timer.getFullYear().toString() + timer.getMonth().toString() + timer.getDate().toString();

        // 每天取1次权限库列表
        var projectData = GM_getValue(gitlabConfig.gitlabProjectListKey, {});
        if (projectData.date == dateStr) {
            projectList = projectData.list;
            start();
            return;
        }

        // 获取有权限库列表
        getGitlabProjectList(1, function (res) {
            for (var i in res) {
                projectList[res[i].name] = res[i].id;
            }

            getGitlabProjectList(2, function (res) {
                for (var i in res) {
                    projectList[res[i].name] = res[i].id;
                }

                var _data = {
                    list: projectList,
                    date: dateStr
                };
                GM_setValue(gitlabConfig.gitlabProjectListKey, _data);
                // 开始执行
                start();
            });
        });
    }

    // 开始
    function start() {
        if (!checkAllow()) {
            return ;
        }

        // 监控请求
        $(window.document).ajaxComplete(function( event, xhr, settings ) {
            var _project = getProject();
            if (!_project) {
                return;
            }
            eventAjax(settings.url.trim(), settings.data, xhr.responseJSON, function () {});
            switch(settings.url.trim()) {
                // go提交任务
                case '/dockertool/new_task_ajax':
                case '/gitool/new_task_ajax':
                    if (xhr.responseJSON.status == 'success') {
                        var _repo_id = getQueryVariable(settings.data, 'repo_id');
                        var is_add = false
                        for(var _i in hotProjectList) {
                            if (hotProjectList[_i].id == _repo_id) {
                                hotProjectList[_i].num += 1;
                                is_add = true;
                                break;
                            }
                        }

                        if (!is_add) {
                            hotProjectList.push({id: _repo_id, num: 1});
                        }

                        GM_setValue(gitlabConfig.hotProjectKey, hotProjectList);
                    }
                    return;
                // 开始测试
                /*case '/test_env/start_test_ajax':
                    return;
                // 更新代码
                case '/test_env/update_test_env_ajax':
                case '/dockertool/update_test_env_ajax':
                    return;
                // 测试通过
                case '/test_env/update_test_pass_ajax':
                    return;
                // 测试不通过
                case '/test_env/update_test_failed_ajax':
                    return;
                // 发布预上线
                case '/gitool/release_pre_env_ajax':
                case '/dockertool/release_pre_env_ajax':
                    return;
                // 开始预上线
                case '/gitool/start_pre_test_ajax':
                    return;
                // 预上线通过
                case '/gitool/update_pre_test_pass_ajax':
                    return;
                // 预上线不通过
                case '/gitool/update_pre_test_failed_ajax':
                case '/javatool/update_pre_test_failed_ajax':
                    return;
                // 上线
                case '/gitool/release_online_ajax':
                case '/dockertool/release_online_ajax':
                    return;*/
                // 回滚
                case '/gitool/rollback_online_ajax':
                case '/dockertool/rollback_online_ajax':
                    sendDing(ROLLBACK_ONLINE_TOKEN, _project, '【' + userName + '】已回滚', function () {});
                    return;
            }
        });

        // 创建任务
        if (status == 'new_task') {
            // 热门项目排序
            hotProjectList = hotProjectList.sort(compare('num'));

            $('#select_repo option:selected').prop('selected', false);
            // 加 热门 标记
            for(var _i in hotProjectList) {
                var _this = $('#select_repo option[value=' + hotProjectList[_i].id + ']');
                if (_this.length < 1) {
                    continue;
                }

                $('#select_repo').prepend(_this.text('🔥 ' + _this.text()));
            }
            $('#select_repo option:eq(0)').prop('selected', true);
            $("#select_repo").comboSelect();

            // 触发选库操作
            $('#select_repo').change(function () {
                // 获取库名
                var _project = getProject();
                if (!_project) {
                    // 初始化分支
                    initBranchHtmlFunc([]);
                    // 初始化提交信息
                    initCommitHtmlFunc();
                    return;
                }

                // 获取分支列表
                project_id = projectList[_project];
                getBranchList(project_id, function(res) {
                    if (res.length <= 0) {
                        // 初始化分支
                        initBranchHtmlFunc([]);
                        // 初始化提交信息
                        initCommitHtmlFunc();
                        return;
                    }

                    // 渲染分支列表
                    branchHtmlFunc(res);

                    var _branch = $('#inputBranch').val();
                    if (!_branch) {
                        // 初始化提交信息
                        initCommitHtmlFunc();
                        return;
                    }

                    if (res.length < 1) {
                        return;
                    }

                    for (var i in res) {
                        if (res[i].name == _branch) {
                            // 获取最新commitId
                            $('#inputCommitId').val(res[i].commit.id);
                            // $('#inputCommitMsg').val(res[i].commit.title.replaceAll("'", '').replaceAll('"', ''));
                            $('#inputReview').val(res[i].commit.web_url);
                            setReview('zhangjinzhu');
                            setUpOnline('zhangjinzhu');
                            switch (type) {
                                case 'gitool':
                                    $('#check_commit_id')[0].click();
                                    break;
                                case 'dockertool':
                                    $('#check_img').removeClass('disabled');
                                    $('#check_img')[0].click();
                                    break;
                            }
                        }
                    }
                });
            });
            // 初始化
            $("#select_repo").change();

            // 触发选分支操作
            $('body').delegate('#inputBranch', 'change', function () {
                if (!project_id) return ;

                // 获取最新commitId
                getCommitList(project_id, $(this).val(), function (res) {
                    if (res.length < 1) {
                        return;
                    }

                    $('#inputCommitId').val(res[0].id);
                    // $('#inputCommitMsg').val(res[0].title.replaceAll("'", '').replaceAll('"', ''));
                    $('#inputReview').val(res[0].web_url);
                    setReview('zhangjinzhu');
                    setUpOnline('zhangjinzhu');
                    switch (type) {
                        case 'gitool':
                            $('#check_commit_id')[0].click();
                            break;
                        case 'dockertool':
                            $('#check_img').removeClass('disabled');
                            $('#check_img')[0].click();
                            break;
                    }
                });
            });
        } else if (status == 'edit_task') {
            // 修改任务
            var _project = getProject();
            if (!_project) {
                return;
            }

            project_id = projectList[_project];
            getBranchList(project_id, function(res) {
                if (res.length <= 0) {
                    // 初始化分支
                    initBranchHtmlFunc([]);
                    // 初始化提交信息
                    initCommitHtmlFunc();
                    return;
                }

                // 渲染分支列表
                branchHtmlFunc(res);

                var _branch = $('#inputBranch').val();
                if (!_branch) {
                    // 初始化提交信息
                    initCommitHtmlFunc();
                    return;
                }

                // 获取最新commitId
                getCommitList(project_id, _branch, function (res) {
                    if (res.length < 1) {
                        return;
                    }

                    $('#inputCommitId').val(res[0].id);
                    switch (type) {
                        case 'gitool':
                            $('#check_commit_id')[0].click();
                            break;
                        case 'dockertool':
                            $('#check_img').removeClass('disabled');
                            $('#check_img')[0].click();
                            break;
                    }
                });
            });

            $('body').delegate('#inputBranch', 'change', function () {
                if (!project_id) return ;

                // 获取最新commitId
                getCommitList(project_id, $(this).val(), function (res) {
                    if (res.length < 1) {
                        return;
                    }

                    $('#inputCommitId').val(res[0].id);
                    // $('#inputCommitMsg').val(res[0].title.replaceAll("'", '').replaceAll('"', ''));
                    $('#inputReview').val(res[0].web_url);
                    setReview('zhangjinzhu');
                    setUpOnline('zhangjinzhu');
                    switch (type) {
                        case 'gitool':
                            $('#check_commit_id')[0].click();
                            break;
                        case 'dockertool':
                            $('#check_img').removeClass('disabled');
                            $('#check_img')[0].click();
                            break;
                    }
                });
            });
        } else if (status == 'my_task_list') {
            $('.page-header').text('我们的任务清单');
            // 获取当前任务
            getTaskList(userName, function (res) {
                if (res.code != 0 || res.data.length < 1) return ;
                var list = res.data;

                var idList = {};
                for (var _j in list) {
                    var _info = list[_j];
                    idList[_info.branch_id] = _j;
                }

                var oldIds = {};
                var listObj;
                // 无任务状况
                if ($('#page-wrapper .row').length < 2) {
                    listObj = $('<div>').addClass('row');
                    listObj.append($('<div>').addClass('col-lg-12'))
                    listObj.find('.col-lg-12').append($('<div>').addClass('panel panel-info'));
                    listObj.find('.col-lg-12 .panel').append($('<div>').addClass('panel-heading').text('进行中' + list.length + '个任务'));
                    listObj.find('.col-lg-12 .panel').append($('<div>').addClass('panel-body'));
                    listObj.find('.col-lg-12 .panel .panel-body').append($('<div>').addClass('table-responsive'));
                    listObj.find('.col-lg-12 .panel .panel-body .table-responsive').append($('<table>').addClass('table table-striped table-bordered table-hover'));
                    listObj.find('.col-lg-12 .panel .panel-body .table-responsive .table').append($('<thead>'));
                    listObj.find('.col-lg-12 .panel .panel-body .table-responsive .table thead').append($('<tr>'));
                    listObj.find('.col-lg-12 .panel .panel-body .table-responsive .table thead tr').append($('<th>').addClass('col-sm-4').text('分支'));
                    listObj.find('.col-lg-12 .panel .panel-body .table-responsive .table thead tr').append($('<th>').addClass('col-sm-1').text('测试人员'));
                    listObj.find('.col-lg-12 .panel .panel-body .table-responsive .table thead tr').append($('<th>').addClass('col-sm-1').text('上线人员'));
                    listObj.find('.col-lg-12 .panel .panel-body .table-responsive .table thead tr').append($('<th>').addClass('col-sm-2').text('创建时间'));
                    listObj.find('.col-lg-12 .panel .panel-body .table-responsive .table thead tr').append($('<th>').addClass('col-sm-2').text('状态'));
                    listObj.find('.col-lg-12 .panel .panel-body .table-responsive .table thead tr').append($('<th>').addClass('col-sm-1').text('操作'));
                    listObj.find('.col-lg-12 .panel .panel-body .table-responsive .table').append($('<tbody>'));
                } else {
                    // 有任务状况
                    listObj = $('#page-wrapper .row:eq(1)');
                    listObj.find('.col-lg-12 .panel .panel-heading').text('进行中' + list.length + '个任务');
                    // 去除重复任务
                    listObj.find('.col-lg-12 .panel .panel-body .table-responsive .table tbody tr').each(function () {
                        var _href = $(this).find('td:eq(5) a').attr('href');
                        if (_href.split('?').length < 2) return;
                        var _query = _href.split('?')[1];
                        var _id = getQueryVariable(_query, 'branch_id');
                        if (!_id) return;
                        oldIds[_id] = true;
                        if (!idList[_id]) return;

                        $(this).find('td:eq(0) p:eq(1)').html('分支：' + list[idList[_id]].branch_name + ' ( ' + list[idList[_id]].project_name + ' ) ' + (list[idList[_id]].env ? '<code style="margin-left:10px;">' + list[idList[_id]].env + '</code>' : ''));
                    });
                }

                for (var k in list) {
                    if (oldIds[list[k].branch_id]) continue;
                    var tr = $('<tr>').append($('<td>'));
                    tr.find('td:eq(0)').append($('<p>').html('作者：' + list[k].author + '<span style="color:red">【他人任务】</span>'));
                    tr.find('td:eq(0)').append($('<p>').html('分支：' + list[k].branch_name + ' ( ' + list[k].project_name + ' ) ' + (list[k].env ? '<code style="margin-left:10px;">' + list[k].env + '</code>' : '')));
                    tr.find('td:eq(0)').append($('<p>').text('改动：' + list[k].commit_msg));
                    tr.find('td:eq(0)').append($('<p>').html('Review：<a target="_blank" href="' + list[k].review_url + '">' + list[k].review_url + '</a>'));
                    tr.append($('<td>').text(list[k].testor));
                    tr.append($('<td>').text(list[k].push_engineer));
                    tr.append($('<td>').html('<p>' + getTime(list[k].create_ts) + '</p><p class="text-primary">' + getTimeStr(list[k].create_ts) + '</p>'));

                    var status;
                    switch (list[k].status) {
                        case 'added':
                            status = '<span class="label label-warning">新任务</span>';
                            break;
                        case 'modify':
                            status = '<span class="label label-primary">任务已修改</span>';
                            break;
                        case 'start_test':
                            status = '<span class="label label-info">Test环境测试中</span>';
                            break;
                        case 'test_failed':
                            status = '<span class="label label-danger">Test环境测试未通过</span>';
                            break;
                        case 'test_pass':
                            status = '<span class="label label-success">Test环境测试通过</span>';
                            break;
                        case 'pre_release':
                            status = '<span class="label label-info">等待开始Pre环境测试</span>';
                            break;
                        case 'start_pre_test':
                            status = '<span class="label label-info">Pre环境测试中</span>';
                            break;
                        case 'pre_failed':
                            status = '<span class="label label-danger">Pre环境人工测试未通过</span>';
                            break;
                        case 'pre_pass':
                            status = '<span class="label label-success">Pre环境人工测试通过</span>';
                            break;
                    }
                    tr.append($('<td>').html('<p>' + status + '</p><p class="text-primary">独立上线</p><p class="text-primary"></p>'));
                    var href = 'http://gitool.plt.babytree-inc.com/gitool/task_detail?branch_id=';
                    if (list[k].type == 'docker') {
                        href = 'http://gitool.plt.babytree-inc.com/dockertool/task_detail?branch_id=';
                    }
                    tr.append($('<td>').html('<td><a class="btn btn-outline btn-info" href="' + href + list[k].branch_id + '">详情</a></td>'));
                    listObj.find('.col-lg-12 .panel .panel-body .table-responsive .table').append(tr);
                }

                $('#page-wrapper').append(listObj);
            });
        }

        // 任务详情页
        if (type == 'dockertool' && status == 'task_detail') {
            //var commitTimer;
            //var commitTimerFunc;

            // 获取库名
            _project = getProject();
            // 获取分支名
            _branch = $('.table-responsive tr:eq(1) .col-lg-10').text();
            _branch_arr = /([a-zA-Z0-9_ ]+)\(.*\).*/i.exec(_branch);
            if (_branch_arr.length > 1) {
                _branch = _branch_arr[1].trim();
            }

            if (_project != '') {
                var query = window.location.search.substr(1),
                    statusStr = $('.table .label').text();
                // 状态上报
                sendEventFunc(getQueryVariable(query, 'branch_id'), statusStr);

                if (statusStr == '已上线') {
                    var tagName = '',
                        ref = '',
                        commid = '';

                    project_id = projectList[_project];
                    var commidArr = $('.table tr:eq(2) td.col-lg-10').text().split('-');
                    if (commidArr.length < 2) return;
                    commid = commidArr[1].trim();
                    if (commid == '') return;

                    // 创建临时上线分支
                    createBranchBtnFunc(project_id, commid, function (html) {
                        $('.col-lg-6:eq(1) .panel-body').prepend(html);
                    });

                    // review btn
                    $('.col-lg-6:eq(1) .panel-body').prepend(reviewBtnFunc(project_id, commid));

                    // 获取最新tag
                    getTagList(project_id, function (res) {
                        if (res.length > 0) {
                            tagName = res[0].name;
                            ref = res[0].target;
                        }

                        // tag btn
                        $('.col-lg-6:eq(1) .panel-body').prepend(tagBtnFunc(project_id, _branch, commid, ref, tagName));
                    });
                    return;
                }
            }

            if ($('#update_test_env').length < 1) {
                return;
            }

            var _commit_str = $('.table-responsive tr:eq(2) .col-lg-10').text();
            var _commit_arr = _commit_str.split('-');
            var _commit = '';
            if (_commit_arr.length > 1) {
                _commit = _commit_arr[1];
            }

            // 获取commit列表
            project_id = projectList[_project];
            getCommitList(project_id, _branch, function (res) {
                if (res.length < 1) {
                    return;
                }

                if (_commit != res[0].id) {
                    $('.table-responsive tr:eq(2) .col-lg-10').html(_commit_str + '<code style="margin-left:10px;">不是最新</code>');
                }

                // 渲染commit
                commitListHtmlFunc(res);

                // 设置commid
                $('#commit_id').val(res[0].id);
            });

            // 更换commitId
            $('body').delegate('#commit_id_select', 'change', function () {
                $('#commit_id').val($(this).val());
            });

        } else if (type == 'gitool' && status == 'task_detail') {
            // 获取库名
            _project = getProject();
            // 获取分支名
            _branch = $('.table-responsive tr:eq(1) .col-lg-10').text();
            _branch_arr = /([a-zA-Z0-9_ ]+)\(.*\).*/i.exec(_branch);
            if (_branch_arr.length > 1) {
                _branch = _branch_arr[1].trim();
            }

            if (_project != '') {
                var query = window.location.search.substr(1),
                    statusStr = $('.table .label').text();

                // 状态上报
                sendEventFunc(getQueryVariable(query, 'branch_id'), statusStr);

                if (statusStr == '已上线') {
                    var tagName = '',
                        ref = '',
                        commid = $('.table tr:eq(4) .col-lg-10').text().trim();
                    project_id = projectList[_project];
                    if (commid == '') return;

                    // 创建临时上线分支
                    createBranchBtnFunc(project_id, commid, function (html) {
                        $('.col-lg-5 .panel-body').prepend(html);
                    });

                    // review btn
                    $('.col-lg-5 .panel-body').prepend(reviewBtnFunc(project_id, commid));
                    // 获取最新tag
                    getTagList(project_id, function (res) {
                        if (res.length > 0) {
                            tagName = res[0].name;
                            ref = res[0].target;
                        }

                        // tag btn
                        $('.col-lg-5 .panel-body').prepend(tagBtnFunc(project_id, _branch, commid, ref, tagName));
                    });
                    return;
                }
            }

            if ($('#update_test_env').length < 1) {
                return;
            }

            var _commit = $('.table-responsive tr:eq(4) .col-lg-10').text();

            // 获取commit列表
            project_id = projectList[_project];
            getCommitList(project_id, _branch, function (res) {
                if (res.length < 1) {
                    return;
                }

                if (_commit != res[0].id) {
                    $('.table-responsive tr:eq(4) .col-lg-10').html(_commit + '<code style="margin-left:10px;">不是最新</code>');
                }

                // 渲染commit
                commitListHtmlFunc(res);

                // 设置commid
                $('#commit_id').val(res[0].id);
            });


            $('body').delegate('#commit_id_select', 'change', function () {
                $('#commit_id').val($(this).val());
            });
        } else if (type == 'sql' && status == 'new_task') {
            var db_name = $('#select_db').children('option:selected').data('db_name');
            $('#inputSql').val('use ' + db_name + ';\n');

            $('#select_db').change(function () {
                var db_name = $(this).children('option:selected').data('db_name');
                var inputSql = $("#inputSql");
                var sql = inputSql.val();
                if (!sql) {
                    inputSql.val('use ' + db_name + ';');
                } else {
                    var inputSqlArr = sql.split("\n");
                    inputSqlArr[0] = 'use ' + db_name + ';'
                    inputSql.val(inputSqlArr.join("\n"));
                }
            });
        }
    }

    // ---------------------已上线任务按钮--------------------
    // 状态上报
    function sendEventFunc(branchId, statusStr) {
        if (statusStr == 'Test环境测试中') {
            // 上报
            sendEventAjax(branchId, START_TEST_TASK);
        } else if (statusStr == 'Test环境测试未通过') {
            // 上报
            sendEventAjax(branchId, TEST_FAILED_TASK);
        } else if (statusStr == 'Test环境测试通过') {
            // 上报
            sendEventAjax(branchId, TEST_PASS_TASK);
        } else if (statusStr == '等待开始Pre环境测试') {
            // 上报
            sendEventAjax(branchId, PRE_RELEASE_TASK);
        } else if (statusStr == 'Pre环境测试中') {
            // 上报
            sendEventAjax(branchId, START_PRE_TEST_TASK);
        } else if (statusStr == 'Pre环境人工测试未通过') {
            // 上报
            sendEventAjax(branchId, PRE_FAILED_TASK);
        } else if (statusStr == 'Pre环境人工测试通过') {
            // 上报
            sendEventAjax(branchId, PRE_PASS_TASK);
        } else if (statusStr == '已回滚' || statusStr == '无效分支已关闭') {
            // 上报
            sendEventAjax(branchId, CLOSED_TASK);
        } else if (statusStr == '已上线') {
            // 上报
            sendEventAjax(branchId, ONLINE_TASK);
        }
    }

    // 创建临时上线分支按钮
    function createBranchBtnFunc(project_id, commid, callback) {
        getProjectInfo(project_id, function (res) {
            var isPermiss = false,
                permissions = res.permissions;
            for(var _i in permissions) {
                if (typeof permissions[_i] == 'object' && permissions[_i] != null && permissions[_i].access_level >= 40) {
                    isPermiss = true;
                }
            }

            if (!isPermiss) {
                return false;
            }

            var createBtn = $('<div></div>').addClass('col-lg-12').css({'margin-top': '10px'}).html('<div class="form-group"><a class="btn btn-danger">创建保护分支</a></div>');
            createBtn.find('.btn').click(function () {
                var _branch_name = prompt('请填写临时上线分支名：');
                if (_branch_name == '' || _branch_name == null) {
                    return;
                }

                _branch_name += protectedBranches;
                if (confirm('是否要创建“' + _branch_name + '”保护分支么？')) {
                    createBranch(project_id, _branch_name, commid, function (res) {
                        alert('创建成功');
                        GM_openInTab(res.web_url);
                    });
                }
            });
            callback(createBtn);
        });

        return true;
    }

    // review btn
    function reviewBtnFunc(project_id, commid) {
        review = $('<div></div>').addClass('col-lg-12').css({'margin-top': '10px'}).html('<div class="form-group"><a class="btn btn-success">Review</a></div>');
        review.find('.btn').click(function () {
            var _this = this;
            $(_this).text('生成中...').addClass('disabled');
            // 创建分支
            createBranch(project_id, 'review', commid, function () {
                // 创建合并请求
                createMergeRequest(project_id, 'master', 'review', 'review', function (res) {
                    // 关闭合并请求
                    closeMergeRequest(project_id, res.iid, function () {
                        $(_this).text('Review').removeClass('disabled');
                        GM_openInTab(res.web_url + '/diffs');
                        // 删除分支
                        deleteBranch(project_id, 'review', function () {});
                    });
                });
            });
        });

        return review;
    }

    // tag btn
    function tagBtnFunc(project_id, _branch, commid, tagCommid, tagName) {
        var tagBtn = $('<div></div>').addClass('col-lg-12').css({'margin-top': '10px'}).html('<div class="form-group"><a class="btn btn-success">添加标签</a><span> 当前标签：' + tagName + '</span></div>');
        if (_branch != 'master') {
            tagBtn.find('.btn').addClass('disabled').text('不能打标签');
        } else {
            getCommitList(project_id, _branch, function (res) {
                var tag_num = 999;
                var online_num = 999;
                for(var _i in res) {
                    if (res[_i].id == commid){
                        online_num = Number(_i);
                    }
                    if (res[_i].id == tagCommid) {
                        tag_num = Number(_i);
                    }
                }

                if (tag_num == online_num) {
                    tagBtn.find('.btn').addClass('disabled').text('已打标签');
                } else if (tag_num < online_num) {
                    tagBtn.find('.btn').addClass('disabled').text('之前已上任务');
                }
            });
        }

        tagBtn.find('.btn').click(function () {
            var tag = prompt('请填写标签：', tagName);
            if (tag == '' || tag == null || tag == tagName) {
                return;
            }

            addTag(project_id, tag, commid, function () {
                alert('添加成功');
                window.location.reload();
            });
        });

        return tagBtn;
    }

    // ---------------------API---------------------

    // 获取钉机器人token
    function getDingRobotToken(result) {
        var url = dingRobotTokenUrl + '?_=' + (new Date()).getTime();

        getDataFromApi({
            method: 'GET',
            url: url,
            cb: function (res) {
                if (res.status === 200 || res.status === 201) {
                    result(res.data);
                } else if (res.status === 401 || res.status === 403) {
                    alert('您没有权限');
                }
            },
            debug: false
        });

        return;
    }

    // 发送钉钉消息
    function sendDing(key, project, content, result) {
        var dingToken = dingTokenList[key];
        if (!dingToken) {
            return;
        }
        var url = dingUrl + dingToken;

        getDataFromApi({
            method: 'POST',
            url: url,
            headers: {
                'Content-Type': 'application/json'
            },
            data: '{"msgtype": "text","text": {"content":"' + project + ':' + content + '"}}',
            cb: function (res) {
                if (res.status === 200 || res.status === 201) {
                    result(res.data);
                } else if (res.status === 401 || res.status === 403) {
                    alert('您没有权限');
                }
            },
            debug: false
        });

        return;
    }

    function eventAjax(url, params, response, result) {
        getDataFromApi({
            method: 'POST',
            url: eventUrl,
            data: JSON.stringify({
                name: userName,
                url: url,
                params: params,
                response: response,
                version: GM_info.script.version
            }),
            headers: {
                'Content-Type': 'application/json'
            },
            cb: function (res) {
                if (res.status === 200 || res.status === 201) {
                    result(res.data);
                } else if (res.status === 401 || res.status === 403) {
                    alert('您没有权限');
                }
            },
            debug: false
        });

        return;
    }

    function sendEventAjax(branch_id, status) {
        getDataFromApi({
            method: 'POST',
            url: eventUrl,
            data: JSON.stringify({
                name: userName,
                url: 'update_task_status_ajax',
                params: 'branch_id=' + branch_id + '&status=' + status,
                response: {'status': 'success'},
                version: GM_info.script.version
            }),
            headers: {
                'Content-Type': 'application/json'
            },
            cb: function (res) {
            },
            debug: false
        });

        return;
    }

    function getTaskList(userName, result) {
        getDataFromApi({
            method: 'GET',
            url: getTaskListUrl + '?user_name=' + userName,
            cb: function (res) {
                if (res.status === 200 || res.status === 201) {
                    result(res.data);
                } else if (res.status === 401 || res.status === 403) {
                    alert('您没有权限');
                }
            },
            debug: false
        });

        return;
    }

    // 获取GitLab有权限代码库
    function getGitlabProjectList(page, result) {
        var url = gitlabConfig.baseHost + gitlabConfig.uris.projectList + token;
        url = url.replace('%page%', page);

        getDataFromApi({
            method: 'GET',
            url: url,
            cb: function (res) {
                if (res.status === 200 || res.status === 201) {
                    result(res.data);
                } else if (res.status === 401 || res.status === 403) {
                    alert('您没有权限');
                }
            },
            debug: false
        });

        return;
    }

    // 获取项目信息
    function getProjectInfo(project, result) {
        var url = gitlabConfig.baseHost + gitlabConfig.uris.projectInfo + token;
        url = url.replace('%project%', project);

        getDataFromApi({
            method: 'GET',
            url: url,
            cb: function (res) {
                if (res.status === 200 || res.status === 201) {
                    result(res.data);
                } else if (res.status === 401 || res.status === 403) {
                    alert('您没有权限');
                }
            },
            debug: false
        });

        return;
    }

    // 获取分支列表
    function getBranchList(project, result) {
        var url = gitlabConfig.baseHost + gitlabConfig.uris.branchList + token;
        url = url.replace('%project%', project);

        getDataFromApi({
            method: 'GET',
            url: url,
            cb: function (res) {
                if (res.status === 200 || res.status === 201) {
                    result(res.data);
                } else if (res.status === 401 || res.status === 403) {
                    alert('您没有权限');
                }
            },
            debug: false
        });

        return;
    }

    // 获取Commit列表接口
    function getCommitList(project, branch, result) {
        var url = gitlabConfig.baseHost + gitlabConfig.uris.queryChange + token;
        url = url.replace('%project%', project).replace('%branch%', branch);
        getDataFromApi({
            method: 'GET',
            url: url,
            cb: function (res) {
                if (res.status === 200 || res.status === 201) {
                    result(res.data);
                } else if (res.status === 401 || res.status === 403) {
                    alert('您没有权限');
                }
            },
            debug: false
        });

        return;
    }

    // 获取Tag列表接口
    function getTagList(project, result) {
        var url = gitlabConfig.baseHost + gitlabConfig.uris.getTagList + token;
        url = url.replace('%project%', project);
        getDataFromApi({
            method: 'GET',
            url: url,
            cb: function (res) {
                if (res.status === 200 || res.status === 201) {
                    result(res.data);
                } else if (res.status === 401 || res.status === 403) {
                    alert('您没有权限');
                }
            },
            debug: false
        });

        return;
    }

    // 创建分支
    function createBranch(project, branch, commid, result) {
        var url = gitlabConfig.baseHost + gitlabConfig.uris.createBranch + token;
        url = url.replace('%project%', project);
        getDataFromApi({
            method: 'POST',
            url: url,
            data: 'branch=' + branch + '&ref=' + commid,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            cb: function (res) {
                if (res.status === 200 || res.status === 201) {
                    result(res.data);
                } else if (res.status === 401 || res.status === 403) {
                    alert('您没有权限');
                }
            },
            debug: false
        });

        return;
    }

    // 删除分支
    function deleteBranch(project, branch, result) {
        var url = gitlabConfig.baseHost + gitlabConfig.uris.deleteBranch + token;
        url = url.replace('%project%', project).replace('%branch%', branch);
        getDataFromApi({
            method: 'DELETE',
            url: url,
            cb: function (res) {
                if (res.status === 200 || res.status === 201 || res.status === 204) {
                    result(res.data);
                } else if (res.status === 401 || res.status === 403) {
                    alert('您没有权限');
                } else if (res.status === 404) {
                    result('');
                }
            },
            debug: false
        });

        return;
    }

    // 创建分支合并
    function createMergeRequest(project, source_branch, target_branch, title, result) {
        var url = gitlabConfig.baseHost + gitlabConfig.uris.createMergeRequest + token;
        url = url.replace('%project%', project);
        getDataFromApi({
            method: 'POST',
            url: url,
            data: 'source_branch=' + source_branch + '&target_branch=' + target_branch + '&title=' + title,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            cb: function (res) {
                if (res.status === 200 || res.status === 201) {
                    result(res.data);
                } else if (res.status === 401 || res.status === 403) {
                    alert('您没有权限');
                }
            },
            debug: false
        });

        return;
    }

    // 关闭分支合并
    function closeMergeRequest(project, merge_request_id, result) {
        var url = gitlabConfig.baseHost + gitlabConfig.uris.updateMergeRequest + token;
        url = url.replace('%project%', project).replace('%merge_request%', merge_request_id);
        getDataFromApi({
            method: 'PUT',
            url: url,
            data: 'state_event=close',
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            cb: function (res) {
                if (res.status === 200 || res.status === 201) {
                    result(res.data);
                } else if (res.status === 401 || res.status === 403) {
                    alert('您没有权限');
                }
            },
            debug: false
        });

        return;
    }

    // 添加标签
    function addTag(project, tag, commid, result) {
        var url = gitlabConfig.baseHost + gitlabConfig.uris.addTag + token;
        url = url.replace('%project%', project);
        getDataFromApi({
            method: 'POST',
            url: url,
            data: 'tag_name=' + tag + '&ref=' + commid,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            cb: function (res) {
                if (res.status === 200 || res.status === 201) {
                    result(res.data);
                } else if (res.status === 401 || res.status === 403) {
                    alert('您没有权限');
                }
            },
            debug: false
        });

        return;
    }



    // ---------------------HTML---------------------
    // 设置TOKEN
    function setToken() {
        if (token.length > 0) {
            token = '********************';
        }
        var _token = prompt('请输入Gitlab Token\n\n获取Gitlab Token说明：\n1、打开' + gitlabConfig.baseHost + '\n2、点击右上角用户头像选择“偏好设置”\n3、左侧列表中选择“访问令牌”\n4、添加个人访问令牌\n5、将TOKEN粘贴到这里\n6、完成', token);
        if (_token == '' || _token == null || _token == token) {
            return '';
        }

        GM_setValue(gitlabConfig.gitlabTokenKey, _token);
        return _token;
    }

    // 初始化分支输入框
    function initBranchHtmlFunc() {
        switch (type) {
            case 'gitool':
                $('#form .form-group:eq(1) .col-lg-7').html(branchHtml);
                break;
            case 'dockertool':
                $('#form .form-group:eq(1) .col-lg-5:eq(0)').html(branchDockerHtml);
                $('#check_img').removeClass('disabled');
                break;
        }

        return;
    }

    // 渲染分支输入框
    function branchHtmlFunc(branchList) {
        var branch = '';
        branchList = branchList.reverse();
        // var _branch = $('#inputBranch').val();
        var html = $('<select></select>').attr('id', 'inputBranch').attr('name', 'branch_name').addClass('form-control');
        // 受保护分支优先
        for (var i in branchList) {
            if (!branchList[i].protected) continue;
            branch = branchList[i].name;
            html = html.append($('<option></option>').val(branch).text('🔒 ' + branch));
        }

        for (var j in branchList) {
            if (branchList[j].protected) continue;
            branch = branchList[j].name;
            html = html.append($('<option></option>').val(branch).text(branch));
        }

        switch (type) {
            case 'gitool':
                $('#form .form-group:eq(1) .col-lg-7').html(html);
                $("#inputBranch").comboSelect();
                $('.combo-dropdown').css('z-index', 3);
                $('#form .form-group:eq(1) .col-lg-7 .combo-select').css('max-width', 'none');


                break;
            case 'dockertool':
                $('#inputBranch, #form .form-group:eq(1) .col-lg-5:eq(0) .combo-select').remove();
                $('#CommitIdStatusIcon').before(html);
                $("#inputBranch").comboSelect();
                $('.combo-dropdown').css('z-index', 3);
                $('#form .form-group:eq(1) .col-lg-5:eq(0) .combo-select').css('max-width', 'none');
                break;
            default:
        }

        return;
    }

    // 初始化commit信息
    function initCommitHtmlFunc() {
        switch (type) {
            case 'gitool':
                $('#form .form-group:eq(2) .col-lg-7').removeClass('has-success').removeClass('has-error').removeClass('has-feedback');
                $('#CommitIdStatusIcon').removeClass('glyphicon-ok').removeClass('glyphicon-remove');
                break;
            case 'dockertool':
                $('#inputPackage').val('');
                break;
        }

        $('#inputCommitId').val('');
        // $('#inputCommitMsg').val('');
        $('#inputReview').val('');

        return;
    }

    // 渲染commit输入框
    function commitListHtmlFunc(commitList) {
        // 修改commit下拉样式
        GM_addStyle('.combo-dropdown {max-width: unset;right: 0;left: auto;}');

        var html = $('<select></select>').attr('id', 'commit_id_select').addClass('form-control');
        for (var i in commitList) {
            var text = '';
            if (i == 0) {
                text += '[新]';
            }
            text += commitList[i].title + '  ' + commitList[i].id;
            html = html.append($('<option></option>').val(commitList[i].id).text(text));
        }

        /*
        if (type == 'dockertool') {
            if ($('#page-wrapper .row:eq(1) .col-lg-6:eq(1) .panel-body .form-horizontal:eq(1) .col-lg-5').length > 0) {
                $('#page-wrapper .row:eq(1) .col-lg-6:eq(1) .panel-body .form-horizontal:eq(1) .col-lg-5').append(html);
            } else {
                $('#page-wrapper .row:eq(1) .col-lg-6:eq(1) .panel-body .form-horizontal:eq(0) .col-lg-5').append(html);
            }
        }*/

        $('input#commit_id').parent().append(html);

        $('#commit_id').attr('type', 'hidden');
        $("#commit_id_select").comboSelect();
    }

    // 写入review人
    function setReview(name) {
        $('#select_reviewer option').attr("selected", false);//初始化
        $('#select_reviewer option[value=' + name + ']').attr("selected", true);//设置默认值
        $("#select_reviewer").comboSelect().trigger('change.select');//触发更新
    }

    // 写入上线人
    function setUpOnline(name) {
        $('#select_push_engineer option').attr("selected", false);//初始化
        $('#select_push_engineer option[value=' + name + ']').attr("selected", true);//设置默认值
        $("#select_push_engineer").comboSelect().trigger('change.select');//触发更新
    }

    // 获取当前库名
    function getProject() {
        var _project = '',
            _project_arr = '';

        if (type == 'dockertool' && status == 'task_detail') {
            _project = $('.table-responsive tr:eq(1) .col-lg-10').text();
            if (_project != '') {
                _project_arr = /.*?\(([a-zA-Z0-9_\- ]+)\).*/i.exec(_project);
                if (_project_arr.length > 1) {
                    _project = _project_arr[1].trim();
                }
            }

        } else if (type == 'gitool' && status == 'task_detail') {
            _project = $('.table-responsive tr:eq(1) .col-lg-10').text();
            if (_project != '') {
                _project_arr = /.*?\(([a-zA-Z0-9_\- ]+)\).*/i.exec(_project);
                if (_project_arr.length > 1) {
                    _project = _project_arr[1].trim();
                }
            }

        }else if (status == 'edit_task') {
            _project = $('#inputRepo').val();

        } else if (type == 'gitool' || type == 'dockertool') {
            _project = $('#select_repo').children('option:selected').data('repo_name');
        }

        if (!projectList[_project]) {
            return '';
        }

        return _project;
    }

    // 写入库名
    function setProject(project) {
        switch (type) {
            case 'gitool':
            case 'dockertool':
                var projectVal = $('#select_repo option[data-repo_name=' + project + ']').val();
                $('#select_repo').val(projectVal).nextAll('input').val(project).end().change();
            default:
        }
    }

    // ajax封装
    function getDataFromApi(opts) {
        var debugCallBack = function (res) {
            if (res.status === 200 || res.status === 201) {
                console.log(formatResponseText(res.responseText));
            }
        };

        var formatResponseText = function (text) {
            //var formatText = text.replace(")]}'", "");
            return JSON.parse(text)
        };

        var cb = function (res) {
            var result = {
                status: res.status
            };
            if (res.status === 200 || res.status === 201) {
                result.data = formatResponseText(res.responseText);
            } else if (res.status === 401 || res.status === 403) {
                alert('您没有权限');
                return;
            }

            opts.cb(result);
        };

        var requestOpt = {
            method: opts.method,
            url: opts.url,
            onload: opts.debug ? debugCallBack : cb,
        };

        if (typeof opts.data != 'undefined') {
            requestOpt.data = opts.data;
        }

        if (typeof opts.headers != 'undefined') {
            requestOpt.headers = opts.headers;
        }

        GM_xmlhttpRequest(requestOpt);
    }

    function getQueryVariable(query, variable) {
        var vars = query.split("&");
        for (var i=0;i<vars.length;i++) {
            var pair = vars[i].split("=");
            if(pair[0] == variable){return pair[1];}
        }

        return(false);
    }

    function getTime(ts) {
        var _date = new Date(ts * 1000);
        var _year = _date.getFullYear();
        var _month = (_date.getMonth() + 1) < 10 ? '0' + (_date.getMonth() + 1) : (_date.getMonth() + 1);
        var _day = _date.getDate() < 10 ? '0' + _date.getDate() : _date.getDate();
        var _hour = _date.getHours() < 10 ? '0' + _date.getHours() : _date.getHours();
        var _minute = _date.getMinutes() < 10 ? '0' + _date.getMinutes() : _date.getMinutes();
        var _second = _date.getSeconds() < 10 ? '0' + _date.getSeconds() : _date.getSeconds();
        return _year + '-' + _month + '-' + _day + ' ' + _hour + ':' + _minute + ':' + _second;
    }

    function getTimeStr(ts) {
        var nowTs = new Date().getTime() / 1000;
        var month = Math.floor((nowTs - ts) / 60);
        if (month < 60) {
            return month + '分钟前';
        } else if (month < 1440) {
            return Math.floor(month / 60) + '小时前';
        } else if (month < 43200) {
            return Math.floor(month / 1440) + '天前';
        } else {
            return Math.floor(month / 43200) + '月前';
        }

        return '';
    }

    // 版本判断
    function versionStringCompare(preVersion='', lastVersion='') {
        var sources = preVersion.split('.');
        var dests = lastVersion.split('.');
        var maxL = Math.max(sources.length, dests.length);
        var result = 0;
        for (let i = 0; i < maxL; i++) {
            let preValue = sources.length>i ? sources[i]:0;
            let preNum = isNaN(Number(preValue)) ? preValue.charCodeAt() : Number(preValue);
            let lastValue = dests.length>i ? dests[i]:0;
            let lastNum =  isNaN(Number(lastValue)) ? lastValue.charCodeAt() : Number(lastValue);
            if (preNum < lastNum) {
                result = -1;
                break;
            } else if (preNum > lastNum) {
                result = 1;
                break;
            }
        }
        return result;
    }

    // 对象排序使用
    function compare(property){
        return function(a,b){
            var value1 = a[property];
            var value2 = b[property];
            return value1 - value2;
        }
    }

    function checkAllow() {
        if (typeof window.location.pathname == 'undefined' || window.location.pathname == '' || window.location.pathname == null) {
            return false;
        }

        var arr = allowUrlArr[window.location.pathname];

        if (typeof arr == 'undefined') {
            return false;
        }

        if (typeof arr == 'boolean') {
            return arr;
        }

        if (typeof arr == 'object' && arr.length == 0) {
            return false;
        }

        for (var _i in arr) {
            for (var _j in arr[_i]) {
                var val = getQueryVariable(window.location.search.substr(1), _j);
                if (val != arr[_i][_j]) {
                    return false;
                }
            }
        }

        return true;
    }
})();
