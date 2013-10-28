
var Homepage = (function homepage(defaultVals) {
	'use strict';

	var $window = $(window),
		$doc = $(document),
		$body = $(document.body),
		$container = $body.find('#grid'),
		$wrap = $body.find('#grid-wrap'),
		$menu = $body.find('#menu'),
		$articleMenu = $body.find('#articleMenu'),
		$articleClose = $body.find('#close'),
		$menuLines = $body.find('#lines'),
		$searchBox = $body.find('#searchBox'),
		$article = $('#article'),
        $loading = $('#loading'),
		winHeight = $window.height(),
		COLUMN_WIDTH = $container.children('li:not(.double):first').outerWidth(true), // include margins
		MATRIX_REGEX = /(-?\d+)/g,
		MATRIX_X = 1,
		MATRIX_Y = 2,
		SOON = 60,
		OPACITY_TIMEOUT = 16,
		ASAP = 0,
		PADDING = 10,
		MIN_OPACITY = 0.005,
		SCROLL_TIMEOUT_LEN = 200,
		END_CLOSE_ARTICLE_TIMEOUT_LEN = 220,
		RESIZE_TIMEOUT_LEN = 850,
		ANIMATION_THRESHOLD = -100,
		MAX_PER_LOAD_DEBOUNCE = 5,
		ANIMATION_EL_THRESHOLD = 1,
		LOADING_Y_OFFSET = defaultVals.LOADING_Y_OFFSET,
		LEFT_BAR_OFFSET = 180,
		firstScrollEvent = true,
		scrollTimeout,
		opacityTimeout,
		loadAnimTimeout,
		resizeTimeout,
		filterTimeout,
		$lower,
		$offScreenLower,
		$upper,
		$all = $container.find('li'),
		$hidden = $container.find('li'),
		$animateOnScroll,
		$animateOnScrollUpper,
		updateScrollAnimation,
		noScrollEvents = true,
		isDoingTransition = false,
		blocksAdjusted = false,
		loaded = false,
		resized = true,
		setFilter = false,
		jumpBottom = false,
		menuShown,
		isFixed,
		removeOffscreen,
		isLowerClosingState,
		isClosing,
		articleHeight = null,
		updateScrollbarOnClose,
		articleTop,
		articleOpacity = 0,
		overhead,
		underhead,
		upperOffset = 0,
		lowerOffset = 0,
		lowerWinOffset = 0,
		containerHeight,
		setTimeout = window.setTimeout,
		clearTimeout = window.clearTimeout,
		parseInt = window.parseInt,
		requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame,
		cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame,
		round = Math.round,
		abs = Math.abs,
		max = Math.max,
		min = Math.min;

	function setTimeoutWithRAF(fn, t) {
		return setTimeout(requestAnimationFrame.bind(this, fn), t);
	}

	function getCurTop ($el) {
		return parseInt($el.css('transform').match(MATRIX_REGEX)[MATRIX_Y], 10);
	}

	function isOnScreen ($el, scrollTop, padding) {
		var thisTop = getCurTop($el) + (padding || 0),
			height = $el.data('isotopeItemPosition').height;
		return (thisTop < (scrollTop + winHeight)) && (((thisTop + height) > scrollTop));
	}

	function modifyTransform (offset, hwAccel) {
		return function(i, val) {
			val = val.match(MATRIX_REGEX);
			//console.log((parseInt(val[MATRIX_Y], 10) + offset) + ' ' + (parseInt(val[MATRIX_Y], 10) + offset));
			//return 'translateX(' + val[MATRIX_X] + 'px) translateY(' + (parseInt(val[MATRIX_Y], 10) + offset) + 'px)' + (hwAccel ? 'translateZ(0)' : '');
			return 'translate3d(' + val[MATRIX_X] + 'px, ' + (parseInt(val[MATRIX_Y], 10) + offset) + 'px, 0)';
		};
	}

	function modifyOrigTransform (offset, padding, hwAccel) {
		return function() {
			var val = this.matrix;
			//return 'translateX(' + val[MATRIX_X] + 'px) translateY(' + ((padding || 0) + parseInt(val[MATRIX_Y], 10) + offset) + 'px)' + (hwAccel ? 'translateZ(0)' : '');
			return 'translate3d(' + val[MATRIX_X] + 'px, ' + ((padding || 0) + parseInt(val[MATRIX_Y], 10) + parseInt(offset, 10)) + 'px, 0)';
		};
	}

	function finalizeEndCloseArticle() {
		if(!updateScrollbarOnClose) {
			$wrap.css('overflow', '');
		}

		noScrollEvents = false;
		articleHeight = null;
		firstScrollEvent = true;
		isClosing = false;
		removeOffscreen = true;

		debounceScrollClassToggling();
		debounceLoadAnim();
	}

	function finishEndCloseArticle() {
		if(! updateScrollbarOnClose) {
			$wrap.css('overflow', 'visible');
		}
		$wrap.css('height', containerHeight).removeClass('behind');
		setTimeoutWithRAF(finalizeEndCloseArticle, END_CLOSE_ARTICLE_TIMEOUT_LEN);
	}


	function endCloseArticle() {
		$offScreenLower.css('transform', modifyOrigTransform(-lowerOffset - overhead, 0, true));

		$article.css('top', '-9999px').removeClass('fixed');
		$articleClose.addClass('hidden').removeClass('shown');
		setTimeoutWithRAF(finishEndCloseArticle, END_CLOSE_ARTICLE_TIMEOUT_LEN);
	}

	function closeArticle (scroll, updateScrollbar, scrollTop) {
		var scrollOffset,
			finishScrollClose;

		if(articleHeight === null || isDoingTransition) {
			return;
		}
		if(opacityTimeout) {
			clearTimeout(opacityTimeout);
			opacityTimeout = false;
		}
		noScrollEvents = true;
		isClosing = true;

		if(scroll) {
			scrollTop = scrollTop || window.pageYOffset;
			updateScrollbarOnClose = true;
			scrollOffset = scrollTop - articleTop;
			finishScrollClose = function() {
				$animateOnScroll.removeClass('offScreen').addClass('closing');
				$animateOnScrollUpper.removeClass('offScreen').addClass('closing');
				$lower.css('transform', modifyOrigTransform(-lowerOffset + scrollOffset, 0, true));
				$upper.css('transform', modifyOrigTransform(overhead + scrollOffset, 0, true));

				$article.addClass('fadeOut').css('opacity', MIN_OPACITY);
				$articleClose.addClass('fadeOut').removeClass('shown');
				$menu.removeClass('offScreen hide').addClass('closing' + ((isFixed || isLowerClosingState) ? 'Fast' : '')).css('transform', '');
			};
			if(!isFixed && !isLowerClosingState) {
				$lower.css('transform', modifyTransform(scrollTop - articleTop - articleHeight + winHeight));
				$upper.css('transform', modifyTransform(scrollTop - articleTop), true);

				return requestAnimationFrame(finishScrollClose);
			}
			finishScrollClose();
		} else {
			$animateOnScroll.css('transform', modifyOrigTransform(-lowerOffset - overhead, 0, true));

			if(updateScrollbarOnClose = updateScrollbar) {
				$animateOnScrollUpper.css('transform', modifyOrigTransform(0,0));
			}
			$menu.css('transform', 'translate3d(0, 0, 0)');

			if(updateScrollbarOnClose) {
				$window.scrollTop(articleTop - overhead);
			}

			setTimeoutWithRAF(endCloseArticle, SOON / 2);
		}
	}

	function removeScrollClass() {
		if(removeOffscreen) {
			$all.removeClass('offScreen');
			removeOffscreen = false;
			return requestAnimationFrame(removeScrollClass);
		} else {
			$body.removeClass('scrolling');
		}
		scrollTimeout = null;
	}

	function addScrollClass() {
		$body.addClass('scrolling');
	}

	function applyScrollClass() {
		if(articleHeight === null) {
			requestAnimationFrame(removeScrollClass);
		}
	}

	function debounceScrollClassToggling () {
		if(scrollTimeout) {
			clearTimeout(scrollTimeout);
		} else {
			addScrollClass();
		}

		scrollTimeout = setTimeout(applyScrollClass, SCROLL_TIMEOUT_LEN);
	}

	function doLoadAnim() {
		if(isDoingTransition) {
			return;
		}
		var foundIndex = null,
			count = 0,
			$toAnim,
			lastFoundIndex,
			loadAnimScrollTop = window.pageYOffset;
		$hidden.each(function (i) {
			if(isOnScreen($(this), loadAnimScrollTop, -LOADING_Y_OFFSET - ANIMATION_THRESHOLD)) {
				if(count === 0) {
					foundIndex = i;
				}
				count++;
				lastFoundIndex = i;
				if(!firstScrollEvent && count >= MAX_PER_LOAD_DEBOUNCE) {
					return false;
				}
			} else {
				return count === 0;
			}
		});
		if(foundIndex !== null) {
			$toAnim = ($($hidden.splice(foundIndex, 1 + lastFoundIndex - foundIndex)));
			requestAnimationFrame(function loadAnim() {
				if(isDoingTransition) {
					return;
				}

				$($toAnim.splice(0, ANIMATION_EL_THRESHOLD))
					.addClass('shown').removeClass('offScreen').css('transform', modifyTransform(-LOADING_Y_OFFSET, true));

				if($toAnim.length) {
					return requestAnimationFrame(loadAnim);
				}
				loadAnimTimeout = false;
			});
		} else {
			loadAnimTimeout = false;
		}
	}

	function debounceLoadAnim() {
		//$all.removeClass('offScreen');
		if(loadAnimTimeout || !loaded || $hidden.length === 0) {
			return;
		}
		if  (firstScrollEvent) {
			doLoadAnim();
			return firstScrollEvent = false;
		}
		loadAnimTimeout = setTimeout(doLoadAnim, SOON * 2);
	}

	function fixArticle() {
		$article.addClass('fixed').css('top', 0);

		noScrollEvents = false;
	}

	function fadeArticle() {
		//never set opacity to 0 so webkit can recomposite layers
		if(articleOpacity < MIN_OPACITY) {
			articleOpacity = MIN_OPACITY;
		}
		$article.css('opacity', articleOpacity);
		$articleClose.css('opacity', articleOpacity);
		opacityTimeout = false;
	}

	function finishUnFixArticle() {
		$animateOnScroll.css('transform', modifyOrigTransform(0, 0, true));
		noScrollEvents = false;
	}

	function unfixArticle() {
		articleOpacity = 1;
		if(! opacityTimeout) {
			opacityTimeout = requestAnimationFrame(fadeArticle);
		}

		$article.removeClass('fixed').css('top', articleTop);
		requestAnimationFrame(finishUnFixArticle);
	}

	function endOnClickTransition(scrollTop, scrollTo) {
		$container.removeClass('transition').css('height', containerHeight + articleHeight + overhead + underhead);
		$lower.addClass('offScreen').removeClass('onScreen delay').css('transform', modifyTransform(overhead + (lowerOffset > lowerWinOffset ? lowerOffset - lowerWinOffset : 0)));
		$upper.addClass('offScreen').removeClass('onScreen').css('transform', modifyTransform(scrollTop < upperOffset ? (upperOffset * 2) - scrollTop : upperOffset));
		$articleClose.removeClass('shown').css('zIndex', 3);

		$all.each(function() {
			this.matrix = $(this).css('transform').match(MATRIX_REGEX);
		});

		$article.removeClass('fadeIn');
		$menu.addClass('offScreen');
		$window.scrollTop(scrollTo);

		isDoingTransition = false;
		updateScrollAnimation = false;
		isLowerClosingState = false;

		// if (!blocksAdjusted) {
		// 	if (lowerOffset > lowerWinOffset) {
		// 		$lower.css('transform', modifyTransform(lowerOffset - lowerWinOffset));
		// 	}
		// 	blocksAdjusted = true;
		// }
	}
	function onScroll() {
		var scrollTop,
			val;

		if(noScrollEvents) {
			return;
		}
		if(isDoingTransition) {
			return requestAnimationFrame(function() {
				endOnClickTransition(window.pageYOffset, articleTop);
			});
		}

		if (articleHeight !== null) {
			if ((scrollTop = window.pageYOffset) < articleTop && (scrollTop > articleTop - overhead)) {
				if (!isFixed) {
					isFixed = true;
					fixArticle();
				} else {
					if(!updateScrollAnimation) {
						updateScrollAnimation = true;
						return $articleClose.css('zIndex', 2);
					}

					if (lowerOffset > winHeight) {
						val = round(-((articleTop - scrollTop)/overhead * (lowerWinOffset + overhead)) -lowerOffset + lowerWinOffset);
					} else {
						val = round(-(articleTop - scrollTop)/overhead * (lowerOffset + overhead));
					}
					$animateOnScroll.css('transform', modifyOrigTransform(val));

					val = abs(articleTop - scrollTop) / overhead;
					if(! menuShown) {
						$menu.css('transform', 'translate3d(' + round(-LEFT_BAR_OFFSET + (LEFT_BAR_OFFSET * val))  + 'px, 0, 0)');
					}
					articleOpacity = (0.6 - (0.625 * val)).toFixed(2);
					if(! opacityTimeout) {
						opacityTimeout = setTimeoutWithRAF(fadeArticle, OPACITY_TIMEOUT);
					}
				}
				updateScrollAnimation = true;

			} else if (scrollTop < articleTop) {
				closeArticle(false, false, scrollTop);
				updateScrollAnimation = false;
			} else if(scrollTop >= articleTop && (scrollTop <= articleTop + articleHeight - winHeight)) {

				// Reset article and lower blocks position
				if (isFixed) {
					noScrollEvents = true;
					isFixed = false;
					return unfixArticle();
				}else if(isLowerClosingState) {
					$articleClose.css('zIndex', 3);
					return isLowerClosingState = false;
				} else if(updateScrollAnimation) {
					$animateOnScrollUpper.css('transform', modifyOrigTransform(0, 0, true));
				}

				if (jumpBottom) { //unjump the blocks under article so tiles go bk to proper position
					$animateOnScroll.css('transform', modifyTransform(-(underhead - lowerWinOffset),true));
					jumpBottom = false;
				}
			} else if ((scrollTop > articleTop + articleHeight - winHeight) && (scrollTop < articleTop + articleHeight + (underhead - winHeight))) {
				if(!isLowerClosingState) {
					$articleClose.css('zIndex', 2);
					return isLowerClosingState = true;
				}
				if (!jumpBottom) {  //jump blocks futher under the article so the tiles move the right amount to close properly
					jumpBottom = true;
					return  $animateOnScroll.css('transform', modifyTransform(underhead - lowerWinOffset,true));
				}

				if (lowerOffset > winHeight) {
					//wow
					val = round(((scrollTop - (articleTop + articleHeight - winHeight)) / underhead * (underhead + upperOffset)) + articleHeight + overhead - winHeight - upperOffset);
				} else {
					val = round((scrollTop - (articleTop + articleHeight - winHeight)) / underhead * (underhead + upperOffset));
				}
				$animateOnScrollUpper.css('transform', modifyOrigTransform(val));

				val = 1 - abs((scrollTop - (articleTop + articleHeight - winHeight + underhead)) / underhead);
				if(!menuShown) {
					$menu.css('transform', 'translate3d(' + (-LEFT_BAR_OFFSET + (LEFT_BAR_OFFSET * val))  + 'px, 0, 0)');
				}

				articleOpacity = (1 - (1 * val)).toFixed(2);
				if(! opacityTimeout) {
					opacityTimeout = setTimeoutWithRAF(fadeArticle, OPACITY_TIMEOUT);
				}

				updateScrollAnimation = true;
			}  else if (scrollTop >= articleTop + articleHeight + (underhead - winHeight)) {
				closeArticle(false, true, scrollTop);
				updateScrollAnimation = false;
				jumpBottom = false;
			}
		} else {
			debounceLoadAnim();
			debounceScrollClassToggling();
		}
	}

	function endResizeTranstion() {
		$all.removeClass('onScreen resized').addClass('offScreen').each(function() {
			this.matrix = $(this).css('transform').match(MATRIX_REGEX);
		});
	}

	function addFilter() {
		$container.removeClass('transition');
	}

	function onTransitionEnd(e) {
		var	scrollOffset,
			scrollTop,
			$transitioned = $(e.target);
		if(isDoingTransition && $transitioned.hasClass('delay')) {
			return endOnClickTransition(window.pageYOffset, articleTop);
		} else if(isClosing && $transitioned.hasClass('closing')) {
			scrollTop = window.pageYOffset;
			scrollOffset = scrollTop - articleTop;
			$all.addClass('offScreen').removeClass('closing').css('transform', modifyTransform(-overhead - scrollOffset));
			$article.removeClass('fadeOut').removeClass('fixed').css('top', '-9999px');
			$articleClose.removeClass('fadeOut').addClass('hidden');
			$window.scrollTop(scrollTop - overhead - scrollOffset);
			requestAnimationFrame(finishEndCloseArticle);
		} else if(!loaded && $container.hasClass('initial')) {
			$hidden.addClass('offScreen');
			noScrollEvents = false;
			$body.css('opacity', 1);
			$container.removeClass('initial');
			$wrap.css('height', $container[0].style.height);
			setTimeoutWithRAF(doLoadAnim, SCROLL_TIMEOUT_LEN);
			loaded = true;
		} else if(!resized && $transitioned.hasClass('resized')) {
			setTimeout(endResizeTranstion, SOON);
			resized = true;
		} else if(!resized) {
			$container.removeClass('transition');
			winHeight = $window.height();
			resized = true;
		} else if(setFilter) {
			filterTimeout = setTimeoutWithRAF(addFilter, SCROLL_TIMEOUT_LEN);
			setFilter = false;
		}
	}

	function onClick(e) {
		var $onScreenUpper,
			$onScreenLower,
			$offScreenUpper,
			$li,
			li,
			$clicked,
			$oldLi,
			scrollTop,
			offset,
			lOffset,
			winOffset;

		if(($clicked = $(e.target)).closest('ul').is($container) && ! $clicked.is($container)) {
			e.preventDefault();
			e.stopPropagation();

			if(isClosing) {
				return;
			} else if(articleHeight !== null) {
				return closeArticle(true);
			}

			$li = $oldLi = $clicked.closest('li');
			$onScreenUpper = [];
			$offScreenUpper = [];
			$upper = [];
			isDoingTransition = true;
			scrollTop = window.pageYOffset;
			upperOffset = 0;
			lowerOffset = 0;

            $loading.removeClass("hidden");
			blocksAdjusted = false;

			$.get($clicked.parent().attr('data-href'), function(articleData) {
				// Inject article
				$article.html(articleData);
				$loading.addClass("hidden");

				$article.imagesLoaded(function () {
					articleHeight = $article.height();

					containerHeight = parseInt(($wrap[0].style.height.replace('px', '') || containerHeight), 10);

					while(($li = $li.prev()).length) {
						li = $li[0];
						if(isOnScreen($li, scrollTop)) {
							offset = getCurTop($li) + $li.data('isotopeItemPosition').height - scrollTop + PADDING;
							if(offset > upperOffset) {
								upperOffset = offset;
							}
							$onScreenUpper.push(li);
						}
						else {
							$offScreenUpper.push(li);
						}
						$upper.push(li);
					}

					$li = $oldLi;
					lowerOffset = scrollTop + articleHeight - getCurTop($li) + PADDING;
					lowerWinOffset = scrollTop + winHeight - getCurTop($li) + PADDING;
					$onScreenLower = [];
					$offScreenLower = [];
					$lower = [$li[0]];

					while(($li = $li.next()).length) {
						li = $li[0];
						if(isOnScreen($li, scrollTop)) {
							offset =  scrollTop + articleHeight - getCurTop($li) + PADDING;
							winOffset = scrollTop + winHeight - getCurTop($li) + PADDING;
							if (offset > lowerOffset) {
								lowerOffset = offset;
							}
							if (winOffset > lowerWinOffset) {
								lowerWinOffset = winOffset;
							}

							$onScreenLower.push(li);
						} else {
							$offScreenLower.push(li);
						}
						$lower.push(li);
					}

					$onScreenUpper = $($onScreenUpper);
					$offScreenUpper = $($offScreenUpper);
					$onScreenLower = $($onScreenLower);
					$offScreenLower = $($offScreenLower);
					$upper = $($upper);
					$lower = $($lower);

					$animateOnScroll = $onScreenLower.add($oldLi).add($offScreenLower.slice(0, parseInt($onScreenUpper.length, 10)));
					$animateOnScrollUpper = $onScreenUpper;

					overhead = max(winHeight, upperOffset);
					underhead = max(winHeight, lowerWinOffset);

					articleTop = scrollTop + overhead;
					offset = scrollTop < upperOffset ? upperOffset - scrollTop : 0;
					lOffset =  min(lowerWinOffset, lowerOffset);
					menuShown = false;
					isFixed = true;
					articleOpacity = 1;

					$body.removeClass('scrolling');
					$wrap.css('height', '').addClass('behind');
					$container.addClass('transition');
					$all.find('.shown').removeClass('shown').addClass('visible');
					$offScreenUpper.addClass('offScreen').css('transform', modifyTransform(-upperOffset - offset));
					$offScreenLower.addClass('offScreen').css('transform', modifyTransform(lOffset));

					requestAnimationFrame(function() {
						$onScreenUpper.removeClass('offScreen').addClass('onScreen').css('transform', modifyTransform(-upperOffset - offset, true));
						$onScreenLower.removeClass('offScreen').addClass('onScreen').css('transform', modifyTransform(lOffset, true));
						$oldLi.removeClass('offScreen').addClass('delay onScreen').css('transform', modifyTransform(lOffset, true));

						$article.addClass('fixed fadeIn').css('top', 0).css('opacity', 1);
						$menu.removeClass('offScreen closing closingFast show').addClass('hide').css('transform', '');
						$articleClose.addClass('shown').removeClass('hidden').css('zIndex', 2).css('opacity', 1);

						$articleMenu.removeClass('hidden');
					});
				});
			});
		}
	}

	function onKeyDown(e) {
		if (e.keyCode === 27) {
			if($searchBox.is(':focus')) {
				return $searchBox.blur();
			}
			closeArticle(true);
		}
	}

	function onLoad(e) {
		//Modernizr.csstransforms3d = false;
		$article.css('opacity', MIN_OPACITY);

		$all.find('a').attr('data-href', function() {
			return this.getAttribute('href');
		}).removeAttr('href');

		$container.isotope({
			itemSelector : 'li',
			masonry: { columnWidth : COLUMN_WIDTH }
		});
	}

	function onUnload(e) {
		$window.scrollTop(0);
	}

	function endResize() {
		winHeight = $window.height();
		firstScrollEvent = true;
		noScrollEvents = false;
		$container.removeClass('transition');
		if(articleHeight === null) {
			debounceLoadAnim();
			containerHeight = parseInt($container[0].style.height.replace('px', ''), 10);
			$wrap.css('height', containerHeight);
		}
	}

	function onResize(e) {
		noScrollEvents = true;

		if(articleHeight === null) {
			if(resized) {
				$container.addClass('transition');
			}
			if(loadAnimTimeout) {
				clearTimeout(loadAnimTimeout);
				loadAnimTimeout = null;
			}
		}
		if(resizeTimeout) {
			clearTimeout(resizeTimeout);
		}
		resizeTimeout = setTimeoutWithRAF(endResize, RESIZE_TIMEOUT_LEN);
		resized = false;
	}

	function onMenuClick() {
		$menu.removeClass('onScreen offScreen hide').addClass('show');
		menuShown = true;
	}

	function onCloseClick() {
		closeArticle(true);
	}

	function onFilterClick(e) {
		var $clicked = $(e.target).closest('li');
		if($clicked.length) {
			noScrollEvents = true;
			setFilter = true;
			clearTimeout(filterTimeout);
			filterTimeout = setTimeoutWithRAF(function() {
				$all.removeClass('offScreen').addClass('visible');
				$container.addClass('transition').isotope({ filter: $clicked.attr('data-filter'), masonry: { columnWidth: COLUMN_WIDTH } });
				$hidden = $([]);
				noScrollEvents = false;
			}, SOON * 3);
			$body.scrollTop(0);
		}
	}


	$window.on('click', onClick);
	$window.on('unload', onUnload);
	$window.on('resize', onResize);

	$menuLines.on('click', onMenuClick);
	$menu.on('click', onFilterClick);
	$articleClose.on('click', onCloseClick);

	$container.on('webkitTransitionEnd transitionend', onTransitionEnd);
	$container.imagesLoaded(onLoad);

	$doc.on('scroll', onScroll);
	$doc.on('keydown', onKeyDown);

	return {
		offset: function() {
			return overhead + lowerOffset;
		},
		articleHeight: function() {
			return articleHeight;
		},
		articleTop: function() {
			return articleTop;
		},
		setState: function(state) {
			$upper = state.$upper;
			$lower = state.$lower;
			$animateOnScroll = $lower.slice(0, $animateOnScroll.length);
			$animateOnScrollUpper = $upper.slice(-$animateOnScrollUpper.length);
		},
		LOADING_Y_OFFSET: LOADING_Y_OFFSET
	};

}(Homepage));