/**
 * @file
 * Клиентский код блоков проекта, собранный в один файл
 *
 * Используемые сущности:
 *  – Клиентский фреймворк i-bem: https://ru.bem.info/platform/i-bem/
 *  – Библиотека для работы с IndexedDB/LocalStorage KvKeeper.js: https://github.com/andre487/kv-keeper.js
 *  – Сущности библиотеки утилитарных блоков bem-core: https://ru.bem.info/platform/libs/bem-core/4.1.1/
 *  – Сущности библиотеки визуальных блоков bem-components: https://ru.bem.info/platform/libs/bem-components/5.0.0/
 */

// Главный блок страницы
modules.define(
    'page',
    ['i-bem-dom', 'next-tick', 'service-worker', 'results', 'spin', 'modal', 'favorites-container', 'templates'],
    function(provide, bemDom, nextTick, ServiceWorker, Results, Spin, Modal, FavoritesContainer) {
        'use strict';

        provide(bemDom.declBlock(this.name, {
            onSetMod: {
                js: {
                    inited: function() {
                        this._domEvents('open-favorites').on('click', this.openFavorites);
                        ServiceWorker.getInstance().register();
                    }
                }
            },

            showResults: function(data) {
                var _this = this;
                nextTick(function() {
                    _this._getResultsBlock()
                        .showResults(data);
                });
            },

            showSpinner: function() {
                this.setMod('state', 'spinner');

                this._getResultsBlock()
                    .setMod('hidden', true);

                this._getSpinnerBlock()
                    .setMod('visible', true);
            },

            hideSpinner: function() {
                this.delMod('state');

                this._getResultsBlock()
                    .delMod('hidden');

                this._getSpinnerBlock()
                    .delMod('visible');
            },

            showAlert: function(message) {
                this._getAlertBlock()
                    .setContent(message)
                    .setMod('visible', true);
            },

            openFavorites: function() {
                this._getFavoritesBlock()
                    .show();
            },

            // Обращение к блоку провоцирует инициализацию, откладываем до первого использования и кешируем
            _getResultsBlock: function() {
                if (!this._resultsBlock) {
                    this._resultsBlock = this._elem('results').findMixedBlock(Results);
                }
                return this._resultsBlock;
            },

            _getSpinnerBlock: function() {
                if (!this._spinnerBlock) {
                    this._spinnerBlock = this._elem('spinner').findChildBlock(Spin);
                }
                return this._spinnerBlock;
            },

            _getAlertBlock: function() {
                if (!this._alertBlock) {
                    this._alertBlock = this._elem('alert').findMixedBlock(Modal);
                }
                return this._alertBlock;
            },

            _getFavoritesBlock: function() {
                if (!this._favoritesBlock) {
                    this._favoritesBlock = this._elem('favorites').findMixedBlock(FavoritesContainer);
                }
                return this._favoritesBlock;
            }
        }));
    }
);

// Поисковая форма
modules.define(
    'search', ['i-bem-dom', 'page', 'input', 'button', 'giphy'],
    function(provide, bemDom, Page, Input, Button, Giphy) {
        'use strict';

        provide(bemDom.declBlock(this.name, {
            onSetMod: {
                js: {
                    inited: function() {
                        this._baseTitle = document.title;

                        this._page = this.findParentBlock(Page);
                        this._input = this.findChildBlock(Input);
                        this._button = this.findChildBlock(Button);

                        this._domEvents().on('submit', this._onSubmit);

                        var curText = this._getTextFromUrl();
                        if (curText) {
                            this._makeSearch(curText, true);
                        }
                    }
                }
            },

            _getTextFromUrl: function() {
                var matches = location.search.match(/.*?text=([^&]+).*/);
                return matches && decodeURIComponent(matches[1]).trim();
            },

            _replaceTextInUrl: function(text) {
                var url = location.href,
                    encodedText = encodeURIComponent(text);

                if (this._getTextFromUrl()) {
                    return url.replace(
                        /^([^?]+)(?:\?(.*?)text=[^&]+(.*))?$/,
                        '$1?$2text=' + encodedText + '$3'
                    );
                }

                return url + (url.indexOf('?') > -1 ? '&' : '?') + 'text=' + encodedText;
            },

            _onSubmit: function(e) {
                e.preventDefault();

                var text = this._input.getVal().trim();
                if (!text) {
                    return this._page.showAlert('Нужно ввести текст запроса');
                }
                this._makeSearch(text);
            },

            _makeSearch: function(text, replace) {
                var _this = this;

                document.title = text + ' – ' + this._baseTitle;

                var url = this._replaceTextInUrl(text);
                if (replace) {
                    history.replaceState(null, document.title, url);
                } else {
                    history.pushState(null, document.title, url);
                }

                this._input.setVal(text);

                _this._lockInput();

                Giphy.search(text)
                    .then(function(data) {
                        _this._unlockInput();
                        _this._page.showResults(data);
                    })
                    .catch(function(err) {
                        _this._unlockInput();
                        _this._page.showResults(null);
                        _this._page.showAlert('Произошла ошибка: ' + err);
                    });
            },

            _lockInput: function() {
                this._input.setMod('disabled', true);
                this._button.setMod('disabled', true);
                this._page.showSpinner();
            },

            _unlockInput: function() {
                this._input.delMod('disabled');
                this._button.delMod('disabled');
                this._page.hideSpinner();
            }
        }));
    }
);

// Блок результатов поиска
modules.define('results', ['i-bem-dom', 'BEMHTML'], function(provide, bemDom, BEMHTML) {
    'use strict';

    provide(bemDom.declBlock(this.name, {
        onSetMod: {
            js: {
                inited: function() {
                    this._emptyMessage = this.domElem.html();
                }
            }
        },

        showResults: function(data) {
            if (!data || !data.data.length) {
                this.domElem.html(this._emptyMessage);

                return this.setMod('empty', true);
            }

            this.delMod('empty');

            var bemJson = data.data.map(this._renderResultItem, this);

            bemDom.update(this.domElem, BEMHTML.apply(bemJson));
        },

        _renderResultItem: function(doc) {
            // Декларацию элемента см. в файле templates.js
            return {
                block: 'results',
                elem: 'item',
                id: doc.id,
                images: doc.images
            };
        }
    }, {
        // Инициализировать только при обращении
        lazyInit: true
    }));
});

// Блок для управления избранным, миксуется к результатам
// В качестве элемента содержит кнопку "добавить в избранное / удалить из избранного"
modules.define(
    'favorites-controller', ['i-bem-dom', 'vow', 'next-tick', 'service-worker', 'kv-keeper', 'promisify'],
    function(provide, bemDom, vow, nextTick, ServiceWorker, KvKeeper, promisify) {
        'use strict';

        // "Прогреваем" соединение с БД
        KvKeeper.preconnect();

        provide(bemDom.declBlock(this.name, {
            onSetMod: {
                js: {
                    inited: function() {
                        this._picture = this.findChildBlock(bemDom.declBlock('picture'));

                        var sources = this._picture._elem('source').domElem
                            .toArray()
                            .map(function(source) {
                                return {
                                    url: source.getAttribute('srcset'),
                                    type: source.getAttribute('type')
                                };
                            });

                        var fallback = this._picture._elem('fallback').domElem.attr('src');

                        this._pictureData = {
                            id: this.params.id,
                            width: this._picture.params['width'],
                            height: this._picture.params['height'],
                            sources: sources,
                            fallback: fallback
                        };

                        var buttonElem = this._elem('button');
                        this._toggleActive = buttonElem.setMod.bind(buttonElem, 'active');

                        this._domEvents('button').on('click', this._onClick);

                        this.__self.isInFavorites(this.params.id)
                            .then(this._toggleActive);
                    }
                }
            },

            _onClick: function() {
                this.__self.toggleFavorite(this.params.id, this._pictureData)
                    .then(this._toggleActive);

                return false;
            }
        }, {
            addToFavorites: function(id, images) {
                return promisify(KvKeeper, 'setItem', 'favorites:' + id, JSON.stringify(images))
                    .then(function() {
                        ServiceWorker.getInstance().notifyAddFavorite(id, images);
                    });
            },

            removeFromFavorites: function(id, images) {
                return promisify(KvKeeper, 'removeItem', 'favorites:' + id)
                    .then(function() {
                        ServiceWorker.getInstance().notifyRemoveFavorite(id, images);
                    });
            },

            isInFavorites: function(id) {
                return promisify(KvKeeper, 'hasItem', 'favorites:' + id);
            },

            toggleFavorite: function(id, images) {
                var _this = this;

                return this.isInFavorites(id)
                    .then(function(isIn) {
                        return vow
                            .all([
                                isIn ?
                                    _this.removeFromFavorites(id, images) :
                                    _this.addToFavorites(id, images),
                                !isIn
                            ])
                            .then(function(results) {
                                return results[1];
                            });
                    });
            },

            getFavoriteById: function(id) {
                return promisify(KvKeeper, 'getItem', 'favorites:' + id)
                    .then(function(data) {
                        return data && JSON.parse(data);
                    });
            },

            getAllFavorites: function() {
                var _this = this;

                return promisify(KvKeeper, 'getKeys')
                    .then(function(keys) {
                        var ids = keys
                            .filter(function(key) {
                                return key.indexOf('favorites:') === 0;
                            })
                            .map(function(key) {
                                // 'favorites:'.length == 10
                                return key.slice(10);
                            });

                        return vow.all(ids.map(_this.getFavoriteById, _this));
                    })
            }
        }));
    }
);

// Контейнер для избранного, показывается по кнопке "Избранное" в шапке
modules.define('favorites-container', ['i-bem-dom', 'modal', 'favorites-controller', 'BEMHTML'],
    function(provide, bemDom, Modal, FavoritesController, BEMHTML) {
        'use strict';

        provide(bemDom.declBlock(this.name, {
            onSetMod: {
                js: {
                    inited: function() {
                        this._window = this.findMixedBlock(Modal);
                        this._itemsContainer = this._elem('items').domElem;

                        this._emptyMessage = this._itemsContainer.html();
                    }
                }
            },

            show: function() {
                var _this = this;

                this._renderFavorites()
                    .then(function(content) {
                        bemDom.update(_this._itemsContainer, content);

                        _this._window.setMod('visible', true);
                    });
            },

            _renderFavorites: function() {
                var _this = this;

                return FavoritesController
                    .getAllFavorites()
                    .then(function(res) {
                        if (!res.length) {
                            return '';
                        }

                        return BEMHTML.apply({
                            block: 'favorites-list',
                            content: res.map(_this._renderFavoriteItem, _this)
                        });
                    });
            },

            _renderFavoriteItem: function(doc) {
                // Декларацию элемента см. в файле templates.js
                return {
                    block: 'favorites-list',
                    elem: 'item',
                    id: doc.id,
                    width: doc.width,
                    height: doc.height,
                    sources: doc.sources,
                    fallback: doc.fallback
                };
            }
        }, {
            // Инициализировать только при обращении
            lazyInit: true
        }));
    }
);

// Хелпер для работы с API Giphy
modules.define('giphy', ['i-bem', 'jquery', 'vow'], function(provide, bem, $, vow) {
    'use strict';

    provide(bem.declBlock(this.name, null, {
        // Тестовый аккаунт, для частых запросов лучше завести свой ключ
        API_KEY: 'dc6zaTOxFJmzC',

        ENDPOINT_SEARCH_URL: 'https://api.giphy.com/v1/gifs/search',

        search: function(text) {
            var url = this.ENDPOINT_SEARCH_URL + '?limit=10&lang=ru&q=' + encodeURIComponent(text) + '&api_key=' +
                this.API_KEY;

            // Приводим промисы jQuery к спецификации Promise/A+
            return vow.resolve($.get(url))
                .then(function(res) {
                    if (res.meta.msg !== 'OK') {
                        throw new Error('Giphy error: ' + res.meta.msg);
                    }
                    return res;
                })
                .catch(function(xhr) {
                    throw new Error('Network error: ' + xhr.statusText);
                });
        }
    }));
});

// Хелпер для работы с сервис-воркером
modules.define('service-worker', ['i-bem'], function(provide, bem) {
    'use strict';

    provide(bem.declBlock(this.name, {
        onSetMod: {
            js: {
                inited: function() {
                    this._serviceWorker = navigator.serviceWorker;
                }
            }
        },

        register: function() {
            if (!this._serviceWorker) {
                return;
            }

            this._serviceWorker
                .register('../service-worker.js')
                .then(function() {
                    console.log('[ServiceWorkerContainer] ServiceWorker is registered!');
                })
                .catch(function(err) {
                    console.error('[ServiceWorkerContainer]', err);
                });
        },

        notifyAddFavorite: function(id, images) {
            this._postMessage('favorite:add', id, images);
        },

        notifyRemoveFavorite: function(id, images) {
            this._postMessage('favorite:remove', id, images);
        },

        _postMessage: function(message, id, data) {
            if (!this._serviceWorker) {
                return;
            }

            this._serviceWorker.ready
                .then(function(registration) {
                    registration.active.postMessage({ message: message, id: id, data: data });
                });
        }
    }, {
        getInstance: function() {
            if (!this._instance) {
                this._instance = new this();
            }
            return this._instance;
        }
    }));
});

// Обернуть в промис node-like функцию
modules.define('promisify', ['vow'], function(provide, vow) {
    'use strict';

    provide(function promisify(obj, methodName, args) {
        var wrapArgs = Array.apply(null, arguments);

        return new vow.Promise(function(resolve, reject) {
            var callArgs = wrapArgs.slice(2)
                .concat(function(err, data) {
                    if (err) {
                        return reject(err);
                    }
                    resolve(data);
                });

            obj[methodName].apply(obj, callArgs);
        });
    });
});

// Инициализация всех блоков страницы
modules.require(['jquery', 'i-bem-dom__init', 'next-tick'], function($, init, nextTick) {
    'use strict';

    $(function() {
        nextTick(init);
    });
});
