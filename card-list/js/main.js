/**
 * 카드리스트 단계별 확대
 * - PC(마우스): mouseenter 시 해당 카드 확대, 리스트를 벗어나면 원래대로
 * - 모바일/태블릿(터치): 탭한 카드 확대, 상태 유지 (기본값: 가운데 카드)
 * - 선택 카드 기준 거리 1 → is-near1, 거리 2 → is-near2
 * - PC에서 다른 카드로 이동 시: ① 전체가 원래 크기로 축소(is-shrinking) → ② 새 카드 기준으로 확대
 */
(function () {
  var lists = document.querySelectorAll('[data-snap-cards]');
  var mqTouch = window.matchMedia('(hover: none), (max-width: 991px)');

  lists.forEach(function (list) {
    var items = Array.prototype.slice.call(list.querySelectorAll('.snap-cards__item'));
    var defaultIndex = Math.floor(items.length / 2);
    var current = -1;   // 현재 확대된 카드
    var pending = -1;   // 축소가 끝난 뒤 확대할 카드
    var shrinkTimer = null;
    var shrinkMs = parseFloat(getComputedStyle(list).getPropertyValue('--snap-card-shrink')) * 1000 || 250;

    function setActive(index) {
      current = index;
      items.forEach(function (item, i) {
        var dist = index < 0 ? -1 : Math.abs(i - index);
        item.classList.toggle('is-active', dist === 0);
        item.classList.toggle('is-near1', dist === 1);
        item.classList.toggle('is-near2', dist === 2);
        item.querySelector('.snap-cards__btn').setAttribute('aria-pressed', dist === 0 ? 'true' : 'false');
      });
      list.classList.toggle('is-focused', index >= 0);
    }

    function cancelShrink() {
      clearTimeout(shrinkTimer);
      shrinkTimer = null;
      list.classList.remove('is-shrinking');
    }

    // 다른 카드로 이동: 원래 크기로 줄어든 뒤 새 카드 확대 (빠르게 지나가면 마지막 카드만 확대)
    function moveTo(index) {
      pending = index;
      if (shrinkTimer) return;
      if (current < 0 || current === index || mqTouch.matches) {
        setActive(index);
        return;
      }
      list.classList.add('is-shrinking');
      shrinkTimer = setTimeout(function () {
        cancelShrink();
        setActive(pending);
      }, shrinkMs);
    }

    function reset() {
      cancelShrink();
      // 터치/좁은 화면은 항상 하나가 열려 있어야 내용이 보이므로 기본 카드 유지
      setActive(mqTouch.matches ? defaultIndex : -1);
    }

    items.forEach(function (item, i) {
      // 마우스 (pointerType으로 터치 시 발생하는 가짜 hover 제외)
      item.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'mouse' && !mqTouch.matches) moveTo(i);
      });
      // 터치 / 키보드 / 클릭
      item.querySelector('.snap-cards__btn').addEventListener('click', function () {
        moveTo(i);
      });
      item.querySelector('.snap-cards__btn').addEventListener('focus', function () {
        moveTo(i);
      });
    });

    list.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse' && !mqTouch.matches) reset();
    });
    list.addEventListener('focusout', function (e) {
      if (!list.contains(e.relatedTarget)) reset();
    });

    // 화면 전환(PC ↔ 모바일) 시 상태 초기화
    mqTouch.addEventListener('change', reset);
    reset();
  });
})();
