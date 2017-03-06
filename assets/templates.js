/**
 * @file
 * Шаблоны блоков проекта в технологии BEMHTML, собранные в один файл
 *
 * Справка по bem-xjst, одним из проявлений которого является BEMHTML: https://ru.bem.info/platform/bem-xjst/
 */

modules.define('templates', ['BEMHTML'], function(provide, BEMHTML) {
    BEMHTML.compile(
        function(match, wrap, block, elem, mode, mod, elemMod, def, tag, attrs, cls, js, bem, mix, content, replace,
            extend, oninit, xjstOptions, appendContent, prependContent, local, applyCtx, applyNext, apply) {

            block('picture')(
                tag()('picture'),

                attrs()(function() {
                    var ctx = this.ctx,
                        style;

                    if (ctx.width && ctx.height) {
                        style = 'width:' + ctx.width + 'px; height:' + ctx.height + 'px';
                    }

                    return { style: style };
                }),

                js()(function() {
                    return {
                        width: this.ctx.width,
                        height: this.ctx.height
                    };
                }),

                content()(function() {
                    var ctx = this.ctx;

                    return [
                        (ctx.sources || []).map(function(img) {
                            return {
                                elem: 'source',
                                url: img.url,
                                media: img.media,
                                type: img.type,
                                sizes: ctx.width
                            };
                        }),
                        {
                            block: 'image',
                            mix: {
                                block: 'picture',
                                elem: 'fallback'
                            },
                            width: ctx.width,
                            height: ctx.height,
                            url: ctx.fallback
                        }
                    ];
                }),

                elem('source')(
                    tag()('source'),

                    attrs()(function() {
                        var ctx = this.ctx;
                        return {
                            srcset: ctx.url,
                            type: ctx.type,
                            media: ctx.media,
                            sizes: ctx.sizes && (ctx.sizes + 'px')
                        };
                    })
                )
            );

            block('results')(
                elem('item')(
                    mix()(function() {
                        return {
                            block: 'favorites-controller',
                            js: { id: this.ctx.id }
                        }
                    }),

                    content()(function() {
                        var images = this.ctx.images.fixed_width;
                        return [
                            {
                                block: 'picture',
                                fallback: images.url,
                                width: images.width,
                                height: images.height,
                                sources: [
                                    {
                                        type: 'image/webp',
                                        url: images.webp
                                    }
                                ]
                            },
                            {
                                block: 'favorites-controller',
                                elem: 'button'
                            }
                        ];
                    })
                )
            );

            block('favorites-list')(
                elem('item')(
                    mix()(function() {
                        return {
                            block: 'favorites-controller',
                            js: { id: this.ctx.id }
                        }
                    }),

                    content()(function() {
                        var ctx = this.ctx;
                        return [
                            {
                                block: 'picture',
                                fallback: ctx.fallback,
                                width: ctx.width,
                                height: ctx.height,
                                sources: ctx.sources
                            },
                            {
                                block: 'favorites-controller',
                                elem: 'button'
                            }
                        ];
                    })
                )
            );
        }
    );

    provide(BEMHTML);
});
