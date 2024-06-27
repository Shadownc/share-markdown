addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
  })
  
  async function handleRequest(request) {
    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === '/create') {
      return await createDocument(request)
    } else if (request.method === 'GET' && url.pathname.startsWith('/doc/')) {
      return await getDocument(url.pathname.replace('/doc/', ''))
    } else if (request.method === 'POST' && url.pathname.startsWith('/delete/')) {
      return await deleteDocument(url.pathname.replace('/delete/', ''))
    } else {
      return new Response(renderHTML(), {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      })
    }
  }
  
  async function createDocument(request) {
    const { markdown, views, expiration } = await request.json()
    const viewsInt = views ? parseInt(views) : null
    const expirationMs = expiration ? Date.now() + parseInt(expiration) * 60 * 1000 : null
  
    if (views !== "" && (isNaN(viewsInt) || viewsInt < 0)) {
      return new Response(JSON.stringify({ error: '访问次数必须是非负整数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' }
      })
    }
  
    const id = generateId()
    const data = { markdown, views: viewsInt, expiration: expirationMs }
    await works_data.put(id, JSON.stringify(data))
    const link = `${new URL(request.url).origin}/doc/${id}`
    return new Response(JSON.stringify({ link }), {
      headers: { 'Content-Type': 'application/json; charset=UTF-8' }
    })
  }
  
  async function getDocument(id) {
    const value = await works_data.get(id)
    if (!value) {
      const errorMessage = encodeBase64('不存在或已被焚毁。')
      return new Response(renderHTML(errorMessage, true, 0, true), {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      })
    }
    
    const data = JSON.parse(value)
    
    if (data.expiration && Date.now() > data.expiration) {
      await works_data.delete(id)
      const errorMessage = encodeBase64('文档已过期。')
      return new Response(renderHTML(errorMessage, true, 0, true), {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
      })
    }
  
    if (data.views !== null) {
      data.views -= 1
      if (data.views <= 0) {
        await works_data.delete(id)
      } else {
        await works_data.put(id, JSON.stringify(data))
      }
    }
  
    const encodedMarkdown = encodeBase64(data.markdown)
    const remainingTime = data.expiration ? Math.max(0, data.expiration - Date.now()) : null
    return new Response(renderHTML(encodedMarkdown, true, data.views, false, remainingTime, id), {
      headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    })
  }
  
  async function deleteDocument(id) {
    await works_data.delete(id)
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json; charset=UTF-8' }
    })
  }
  
  function generateId() {
    return Math.random().toString(36).substr(2, 10)
  }
  
  function encodeBase64(str) {
    const encoder = new TextEncoder()
    const data = encoder.encode(str)
    return btoa(String.fromCharCode(...data))
  }
  
  function decodeBase64(str) {
    const decodedStr = atob(str)
    const data = new Uint8Array(decodedStr.split('').map(char => char.charCodeAt(0)))
    const decoder = new TextDecoder()
    return decoder.decode(data)
  }
  
  function formatRemainingTime(ms) {
    if (ms === null) return '不限时';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}分${seconds}秒`;
  }
  
  function renderHTML(markdown = '', isDocPage = false, remainingViews = 0, isError = false, remainingTime = null, docId = '') { 
    return `
    <!DOCTYPE html>
    <html lang="zh">

    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>分享你的文档</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@4.0.0/github-markdown.min.css">
    <link id="highlight-theme-light" rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.6.0/styles/github.min.css">
    <link id="highlight-theme-dark" rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.6.0/styles/github-dark.min.css" disabled>
    <style>
        :root {
        --bg-color: #fff;
        --text-color: #24292e;
        --link-color: #0366d6;
        --border-color: #e1e4e8;
        --code-bg-color: #f6f8fa;
        }

        @media (prefers-color-scheme: dark) {
        :root {
            --bg-color: #0d1117;
            --text-color: #c9d1d9;
            --link-color: #58a6ff;
            --border-color: #30363d;
            --code-bg-color: #161b22;
        }
        }

        body {
        font-family: Arial, sans-serif;
        background-color: var(--bg-color);
        color: var(--text-color);
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        margin: 0;
        overflow: hidden;
        visibility: hidden;
        }

        .container {
        background-color: var(--bg-color);
        padding: 20px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        max-width: 800px;
        width: 90%;
        max-height: 80vh;
        overflow: hidden;
        border: 1px solid var(--border-color);
        }

        @media (max-width: 768px) {
        .container {
            width: 95%;
            height: 90vh;
        }
        }

        @media (prefers-color-scheme: dark) {
        .container {
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
        }
        }

        textarea,
        input {
        background-color: var(--bg-color);
        color: var(--text-color);
        border: 1px solid var(--border-color);
        width: 100%;
        margin-top: 10px;
        border-radius: 4px;
        padding: 10px;
        }

        textarea {
        height: 200px;
        }

        button {
        background-color: var(--link-color);
        color: #fff;
        border: none;
        padding: 10px;
        cursor: pointer;
        border-radius: 4px;
        width: 100%;
        margin-top: 10px;
        }

        button:hover {
        opacity: 0.8;
        }

        #link {
        margin-top: 20px;
        cursor: pointer;
        color: var(--link-color);
        }

        #link:hover {
        text-decoration: underline;
        }

        .markdown-body {
        max-height: calc(80vh - 100px);
        overflow-y: auto;
        color: var(--text-color);
        padding-right: 10px;
        -webkit-overflow-scrolling: touch;
        }

        .markdown-body pre {
        background-color: var(--code-bg-color);
        position: relative;
        }

        .markdown-body pre:hover .copy-btn {
        opacity: 1;
        }

        .copy-btn {
        position: absolute;
        top: 4px;
        right: 8px;
        width: 50px;
        height: 24px;
        background-color: var(--code-bg-color);
        border: 1px solid var(--border-color);
        color: var(--text-color);
        border-radius: 4px;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.3s;
        font-size: 12px;
        display: flex;
        justify-content: center;
        align-items: center;
        transform: translateY(-6px);
        }

        .theme-toggle {
        position: fixed;
        top: 10px;
        left: 10px;
        cursor: pointer;
        z-index: 1000;
        }

        .theme-toggle input {
        display: none;
        }

        .theme-toggle label {
        display: block;
        width: 40px;
        height: 20px;
        background-color: #ccc;
        border-radius: 20px;
        position: relative;
        transition: background-color 0.3s;
        }

        .theme-toggle label:before {
        content: "";
        display: block;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background-color: #fff;
        position: absolute;
        top: 2px;
        left: 2px;
        transition: transform 0.3s;
        }

        .theme-toggle input:checked+label {
        background-color: #2196F3;
        }

        .theme-toggle input:checked+label:before {
        transform: translateX(20px);
        }

        ::-webkit-scrollbar {
        width: 6px;
        height: 6px;
        }

        ::-webkit-scrollbar-track {
        background-color: var(--bg-color);
        }

        ::-webkit-scrollbar-thumb {
        background-color: var(--border-color);
        border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
        background-color: #aaa;
        }

        .notification {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: var(--link-color);
        color: #fff;
        padding: 10px 20px;
        border-radius: 4px;
        display: none;
        z-index: 1000;
        }

        .form-group {
        margin-bottom: 15px;
        }

        .form-group label {
        display: block;
        font-size: 14px;
        color: var(--text-color);
        margin-bottom: 5px;
        }

        .info-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 20px;
        padding: 10px;
        border-radius: 4px;
        background-color: var(--code-bg-color);
        }

        .info-container p {
        margin: 0;
        font-size: 14px;
        color: var(--text-color);
        }

        .info-container button {
        width: auto;
        padding: 5px 10px;
        margin-left: 10px;
        }
    </style>
    </head>

    <body>
    <div class="theme-toggle">
        <input type="checkbox" id="theme-toggle-checkbox">
        <label for="theme-toggle-checkbox"></label>
    </div>
    <div class="container">
        ${isDocPage ? `
        <article class="markdown-body" id="markdown-container"></article>
        <div class="info-container">
        <div>
            <p>剩余可访问次数: ${remainingViews !== null ? remainingViews : '不限'}</p>
            <p id="remaining-time">剩余时间: ${formatRemainingTime(remainingTime)}</p>
        </div>
        <button onclick="confirmDestruction()">已读-确认销毁</button>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.6.0/highlight.min.js"></script>
        <script>
        const debounce = (func, wait) => {
            let timeout;
            return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
            };
        };

        const markdown = decodeBase64(${ JSON.stringify(markdown) });
        marked.setOptions({
            gfm: true,
            breaks: true,
            headerIds: false,
            highlight: function (code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
            }
        });
        const renderMarkdown = debounce(() => {
            document.getElementById('markdown-container').innerHTML = marked.parse(markdown);
            hljs.highlightAll();
            addCopyButtons();
        }, 300);

        const addCopyButtons = () => {
            const preElements = document.querySelectorAll('pre');
            preElements.forEach(pre => {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.textContent = 'Copy';
            copyBtn.addEventListener('click', () => {
                const code = pre.querySelector('code').innerText;
                navigator.clipboard.writeText(code).then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy';
                }, 2000);
                });
            });
            pre.appendChild(copyBtn);
            });
        };

        const themeToggle = document.getElementById('theme-toggle-checkbox');
        const lightTheme = document.getElementById('highlight-theme-light');
        const darkTheme = document.getElementById('highlight-theme-dark');
        const setTheme = (isDark) => {
            document.documentElement.style.setProperty('--bg-color', isDark ? '#0d1117' : '#fff');
            document.documentElement.style.setProperty('--text-color', isDark ? '#c9d1d9' : '#24292e');
            document.documentElement.style.setProperty('--link-color', isDark ? '#58a6ff' : '#0366d6');
            document.documentElement.style.setProperty('--border-color', isDark ? '#30363d' : '#e1e4e8');
            document.documentElement.style.setProperty('--code-bg-color', isDark ? '#161b22' : '#f6f8fa');
            lightTheme.disabled = isDark;
            darkTheme.disabled = !isDark;
        };

        themeToggle.addEventListener('change', (event) => {
            setTheme(event.target.checked);
        });

        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        themeToggle.checked = prefersDark;
        setTheme(prefersDark);

        document.body.style.visibility = 'visible';
        renderMarkdown();

        function decodeBase64(str) {
            const decodedStr = atob(str);
            const data = new Uint8Array(decodedStr.split('').map(char => char.charCodeAt(0)));
            const decoder = new TextDecoder();
            return decoder.decode(data);
        }

        async function confirmDestruction() {
            const response = await fetch('/delete/${docId}', {
            method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
            alert('文档已销毁');
            window.location.href = '/';
            } else {
            alert('销毁文档时出错');
            }
        }
        let remainingTime = ${ remainingTime };
        const remainingTimeElement = document.getElementById('remaining-time');

        function updateRemainingTime() {
            if (remainingTime !== null) {
            remainingTime -= 1000;
            if (remainingTime <= 0) {
                remainingTime = 0;
                clearInterval(timerInterval);
            }
            remainingTimeElement.textContent = '剩余时间: ' + formatRemainingTime(remainingTime);
            }
        }

        const timerInterval = setInterval(updateRemainingTime, 1000);

        function formatRemainingTime(ms) {
            if (ms === null) return '不限时';
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return \`\${minutes}分\${seconds}秒\`;
            }
        </script>
        ` : `
        <h1>分享一个秘密文档</h1>
        <div class="form-group">
          <label for="markdownText">输入你的 Markdown 内容</label>
          <textarea id="markdownText" placeholder="输入你的 Markdown 内容"></textarea>
        </div>
        <div class="form-group">
          <label for="views">输入可访问次数(留空表示不限次数)</label>
          <input type="number" id="views" value="5" min="0" step="1">
        </div>
        <div class="form-group">
          <label for="expiration">输入有效时间(单位分钟，留空表示不限时)</label>
          <input type="number" id="expiration" value="10" min="1" step="1">
        </div>
        <button onclick="createDocument()">生成分享链接</button>
        <p id="link" onclick="copyLink()"></p>
        <div class="notification" id="notification">链接已复制到剪贴板</div>
        <script>
          const debounce = (func, wait) => {
            let timeout;
            return (...args) => {
              clearTimeout(timeout);
              timeout = setTimeout(() => func.apply(this, args), wait);
            };
          };
  
          const createDocument = debounce(async () => {
            const markdown = document.getElementById('markdownText').value;
            const views = document.getElementById('views').value;
            const expiration = document.getElementById('expiration').value;
            const response = await fetch('/create', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ markdown, views, expiration })
            });
            const data = await response.json();
            if (data.error) {
              alert(data.error);
            } else {
              document.getElementById('link').textContent = data.link;
            }
          }, 300);
  
          const copyLink = debounce(() => {
            const link = document.getElementById('link').textContent;
            navigator.clipboard.writeText(link).then(() => {
              showNotification();
            });
          }, 300);
  
          const showNotification = () => {
            const notification = document.getElementById('notification');
            notification.style.display = 'block';
            setTimeout(() => {
              notification.style.display = 'none';
            }, 2000);
          };
  
          const themeToggle = document.getElementById('theme-toggle-checkbox');
          const lightTheme = document.getElementById('highlight-theme-light');
          const darkTheme = document.getElementById('highlight-theme-dark');
          const setTheme = (isDark) => {
            document.documentElement.style.setProperty('--bg-color', isDark ? '#0d1117' : '#fff');
            document.documentElement.style.setProperty('--text-color', isDark ? '#c9d1d9' : '#24292e');
            document.documentElement.style.setProperty('--link-color', isDark ? '#58a6ff' : '#0366d6');
            document.documentElement.style.setProperty('--border-color', isDark ? '#30363d' : '#e1e4e8');
            document.documentElement.style.setProperty('--code-bg-color', isDark ? '#161b22' : '#f6f8fa');
            lightTheme.disabled = isDark;
            darkTheme.disabled = !isDark;
          };
  
          themeToggle.addEventListener('change', (event) => {
            setTheme(event.target.checked);
          });
  
          const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
          themeToggle.checked = prefersDark;
          setTheme(prefersDark);
  
          document.body.style.visibility = 'visible';
        </script>`}
      </div>
    </body>
    </html>
    `;
  }