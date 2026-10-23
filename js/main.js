// ==========================================================================
// main-section03 : Product Line-up 카드
//  - PC(마우스) : hover로 카드 on
//  - 터치/키보드 : 탭·포커스로 카드 on
// ==========================================================================
(function () {
  var lineup = document.querySelector('[data-lineup]');
  if (!lineup) return;

  var items = Array.prototype.slice.call(lineup.querySelectorAll('.lineup__item'));
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  var current = -1;
  var hoverTimer = null;

  function activate(index) {
    if (index === current || index < 0 || index >= items.length) return;
    current = index;

    items.forEach(function (item, i) {
      var tab = item.querySelector('.lineup__tab');
      var panel = item.querySelector('.lineup__panel');
      var isActive = i === index;

      item.classList.toggle('is-active', isActive);
      item.classList.toggle('is-left', i < index);
      item.classList.toggle('is-right', i > index);
      // on 카드가 가장 위, 멀어질수록 아래로 쌓임
      item.style.setProperty('--z', items.length - Math.abs(i - index));

      tab.setAttribute('aria-expanded', isActive);
      panel.inert = !isActive;
    });
  }

  items.forEach(function (item, i) {
    var card = item.querySelector('.lineup__card');
    var tab = item.querySelector('.lineup__tab');

    // PC hover : 마우스로 빠르게 지나갈 때 깜빡이지 않도록 약간의 지연
    card.addEventListener('mouseenter', function () {
      if (!canHover.matches) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () {
        activate(i);
      }, 80);
    });

    card.addEventListener('mouseleave', function () {
      clearTimeout(hoverTimer);
    });

    // 터치 / 클릭
    card.addEventListener('click', function () {
      activate(i);
    });

    // 키보드
    tab.addEventListener('focus', function () {
      activate(i);
    });
  });

  // 01 카드 "Solution Line-up >" : 다음 카드로 이동
  var nextBtn = lineup.querySelector('[data-lineup-next]');
  if (nextBtn) {
    nextBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      activate(current + 1);
      items[current].querySelector('.lineup__tab').focus({ preventScroll: true });
    });
  }

  activate(0);
})();
