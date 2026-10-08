/**
 * Cafe24 인스타그램 피드 (앱 미사용 / 순수 스크립트)
 * - Instagram API with Instagram Login (graph.instagram.com) 사용
 * - Cafe24 스마트디자인 HTML 안에서는 `{$...}` 가 모듈 변수로 해석될 수 있으므로
 *   이 파일은 반드시 외부 .js 파일로 업로드해서 사용하고, 템플릿 리터럴(`${}`)은 쓰지 않는다.
 */
(function () {
  'use strict';

  var API_VERSION = 'v23.0';
  var FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
  var CACHE_PREFIX = 'instaFeed:';

  /* 캐시 (localStorage 사용 불가 환경에서도 동작하도록 try/catch) */
  function readCache(key, minutes) {
    try {
      var raw = window.localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      var saved = JSON.parse(raw);
      if (Date.now() - saved.time > minutes * 60 * 1000) return null;
      return saved.data;
    } catch (e) {
      return null;
    }
  }

  function writeCache(key, data) {
    try {
      window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ time: Date.now(), data: data }));
    } catch (e) { /* 저장 실패는 무시 */ }
  }

  /* 데모 데이터 (토큰/프록시 미설정 시) */
  function demoData(limit) {
    var types = ['IMAGE', 'CAROUSEL_ALBUM', 'VIDEO', 'IMAGE'];
    var colors = [['#f58529', '#dd2a7b'], ['#8134af', '#515bd4'], ['#feda77', '#f58529'], ['#dd2a7b', '#8134af']];
    var list = [];
    for (var i = 0; i < limit; i++) {
      var c = colors[i % colors.length];
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient></defs>' +
        '<rect width="600" height="600" fill="url(#g)"/>' +
        '<text x="300" y="320" font-family="sans-serif" font-size="48" fill="#fff" text-anchor="middle">POST ' + (i + 1) + '</text></svg>';
      list.push({
        id: 'demo' + i,
        caption: '데모 게시물 ' + (i + 1) + ' — 실제 연동 시 인스타그램 캡션이 노출됩니다. #cafe24 #instagram',
        media_type: types[i % types.length],
        media_url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
        permalink: 'https://www.instagram.com/'
      });
    }
    return list;
  }

  /* 데이터 요청 */
  function fetchFeed(opt) {
    var url;
    if (opt.endpoint) {
      url = opt.endpoint + (opt.endpoint.indexOf('?') > -1 ? '&' : '?') + 'limit=' + opt.limit;
    } else {
      url = 'https://graph.instagram.com/' + API_VERSION + '/me/media' +
        '?fields=' + FIELDS +
        '&limit=' + opt.limit +
        '&access_token=' + encodeURIComponent(opt.token);
    }

    return fetch(url)
      .then(function (res) {
        return res.json().then(function (json) {
          if (!res.ok || json.error) {
            throw new Error((json.error && json.error.message) || ('HTTP ' + res.status));
          }
          return json.data || [];
        });
      });
  }

  /* 렌더링 (캡션은 textContent 로만 넣어 XSS 방지) */
  function createItem(post) {
    var li = document.createElement('li');
    li.className = 'insta-feed__item';

    var a = document.createElement('a');
    a.className = 'insta-feed__link';
    a.href = post.permalink;
    a.target = '_blank';
    a.rel = 'noopener';

    var img = document.createElement('img');
    img.className = 'insta-feed__img';
    // 영상은 thumbnail_url, 이미지/캐러셀은 media_url(캐러셀은 첫 장)
    img.src = post.media_type === 'VIDEO' ? (post.thumbnail_url || post.media_url) : post.media_url;
    img.alt = post.caption ? post.caption.slice(0, 60) : '인스타그램 게시물';
    img.loading = 'lazy';
    img.decoding = 'async';
    a.appendChild(img);

    if (post.media_type === 'VIDEO' || post.media_type === 'CAROUSEL_ALBUM') {
      var badge = document.createElement('span');
      badge.className = 'insta-feed__badge insta-feed__badge--' + (post.media_type === 'VIDEO' ? 'video' : 'carousel');
      badge.setAttribute('aria-hidden', 'true');
      a.appendChild(badge);
    }

    if (post.caption) {
      var cap = document.createElement('span');
      cap.className = 'insta-feed__caption';
      cap.textContent = post.caption;
      a.appendChild(cap);
    }

    li.appendChild(a);
    return li;
  }

  function render(root, posts) {
    var list = root.querySelector('.insta-feed__list');
    var frag = document.createDocumentFragment();
    posts.forEach(function (post) {
      if (post.media_url || post.thumbnail_url) frag.appendChild(createItem(post));
    });
    list.innerHTML = '';
    list.appendChild(frag);
  }

  function showMessage(root, text) {
    var msg = root.querySelector('.insta-feed__message');
    if (!msg) return;
    msg.textContent = text;
    msg.hidden = false;
  }

  /* 초기화 */
  function init(root) {
    var opt = {
      token: (root.getAttribute('data-token') || '').trim(),
      endpoint: (root.getAttribute('data-endpoint') || '').trim(),
      limit: parseInt(root.getAttribute('data-limit'), 10) || 8,
      cache: parseInt(root.getAttribute('data-cache'), 10) || 60
    };

    if (!opt.token && !opt.endpoint) {
      root.classList.add('is-demo');
      render(root, demoData(opt.limit));
      return;
    }

    var cacheKey = (opt.endpoint || opt.token.slice(-12)) + ':' + opt.limit;
    var cached = readCache(cacheKey, opt.cache);
    if (cached) {
      render(root, cached);
      return;
    }

    root.classList.add('is-loading');
    fetchFeed(opt)
      .then(function (posts) {
        posts = posts.slice(0, opt.limit);
        writeCache(cacheKey, posts);
        render(root, posts);
      })
      .catch(function (err) {
        // 토큰 만료(60일) 시 주로 여기로 떨어진다 → 토큰 재발급 필요
        if (window.console) console.warn('[insta-feed]', err.message);
        showMessage(root, '인스타그램 피드를 불러오지 못했습니다.');
      })
      .then(function () {
        root.classList.remove('is-loading');
      });
  }

  function boot() {
    var roots = document.querySelectorAll('.insta-feed');
    for (var i = 0; i < roots.length; i++) init(roots[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
