// SPDX-FileCopyrightText: tuberry
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import GdkPixbuf from 'gi://GdkPixbuf';

import * as UI from './ui.js';
import * as T from './util.js';
import {Key as K, DARK, LIGHT} from './const.js';

import * as Theme from './theme.js';

const {_, _G} = UI;

Gio._promisify(Adw.AlertDialog.prototype, 'choose');

const Icon = {[LIGHT]: 'weather-clear-symbolic', [DARK]: 'weather-clear-night-symbolic'};
const Color = T.omap(Adw.AccentColor, ([k]) => (l => k !== l ? [[l, _G(T.upcase(l, T.id), 'libadwaita')]] : [])(k.toLowerCase()));
const Style = T.vmap({'default': 'No Preference', 'prefer-dark': 'Prefer Dark', 'prefer-light': 'Prefer Light'}, x => _G(x, 'libadwaita')); // from https://gitlab.gnome.org/GNOME/libadwaita/-/blob/main/src/adw-inspector-page.c

class ThemeLabel extends UI.Sign {
    static {
        T.enrol(this);
    }

    constructor(color, icon) {
        super(icon ?? 'object-select-symbolic', !icon, {useMarkup: true});
        if(color) this.insert_child_after(this.$color = new Gtk.Image(), icon ? this.$icon : null);
    }

    setup(dft, str, tran) {
        super.setup(null, dft ? `${tran(str)} <i>(${_G('Default')})</i>` : tran(str)); // ? snapshot.append_fill
        let fill = Adw.AccentColor.to_rgba(Adw.AccentColor[str.toUpperCase()]).to_string();
        this.$color?.set_from_gicon(Gio.BytesIcon.new(T.encode(`<svg fill="${fill}" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32"/></svg>`)));
    }
}

class Sheet extends UI.File {
    static {
        T.enrol(this);
    }

    constructor(icon, tooltipText) {
        super({filter: {mimeTypes: ['text/css']}, open: true}, {tooltipText}, icon);
        this.setup = (_icon, text) => super.setup(null, text);
    }
}

class ThemeDrop extends Gtk.DropDown {
    static {
        UI.enrol(this, '');
    }

    constructor(data, icon, tip) {
        super({valign: Gtk.Align.CENTER, tooltipText: tip});
        let [strv, tran] = Array.isArray(data) ? [data, x => T.escape(T.upcase(x, T.id))] : [Object.keys(data), x => T.escape(data[x])];
        let setup = (x, {string: y}) => x.setup(y === this[UI.defaultv], y, tran);
        UI.once(this, () => this.#buildWidgets(strv, data === Color, setup, icon));
    }

    #buildWidgets(strv, color, setup, icon) {
        this.set_model(Gtk.StringList.new(strv));
        if(strv.length > 9) {
            this.set_enable_search(true);
            this.set_search_match_mode(Gtk.StringFilterMatchMode.SUBSTRING);
            this.set_expression(new Gtk.PropertyExpression(Gtk.StringObject, null, 'string'));
        }
        this.set_list_factory(T.hook({
            setup: (_f, x) => x.set_child(new ThemeLabel(color)),
            bind: (_f, {child, item}) => {
                setup(child, item);
                item.$bind = this.bind_property_full('selected-item', child.$icon, 'visible', GObject.BindingFlags.SYNC_CREATE, (_b, v) => [true, v === item], null);
            },
            unbind: (_f, {item}) => item.$bind.unbind(),
        }, new Gtk.SignalListItemFactory()));
        this.set_factory(T.hook({
            setup: (_f, x) => x.set_child(new ThemeLabel(color, icon)),
            bind: (_f, {child, item}) => setup(child, item),
        }, new Gtk.SignalListItemFactory()));
        this.bind_property_full('value', this, 'selected', T.BIND, (_b, v) => {
            let ret = this.model.get_n_items();
            do ret--; while(ret > -1 && v !== this.model.get_item(ret).string);
            return [ret !== -1, ret];
        }, (_b, v) => [v !== Gtk.INVALID_LIST_POSITION, this.model.get_item(v)?.string ?? '']);
        this.connect('unrealize', () => { this.list_factory = this.factory = null; }); // workaround for https://gitlab.gnome.org/GNOME/gjs/-/issues/614
    }
}

class Wallpaper extends UI.Box {
    static {
        T.enrol(this, {[DARK]: '', [LIGHT]: ''});
    }

    constructor(tip, height = 270) {
        super();
        let width = height * 16 / 9,
            uri = {[LIGHT]: 'picture-uri', [DARK]: 'picture-uri-dark'},
            gset = new Gio.Settings({schema: 'org.gnome.desktop.background'}),
            area = new Gtk.DrawingArea({widthRequest: width, heightRequest: height});
        area.set_draw_func((...xs) => this.#draw(...xs));
        this.$resetv = () => [DARK, LIGHT].forEach(x => gset.reset(uri[x]));
        [LIGHT, DARK].map(key => {
            gset.bind(uri[key], this, key, Gio.SettingsBindFlags.DEFAULT);
            this.connect(`notify::${key}`, () => area.queue_draw());
            return T.hook({
                clicked: () => this.#onClick(tip[key]).then(x => { this[key] = x.get_uri(); }).catch(T.noop),
            }, new Gtk.Button({
                cssClasses: ['suggested-action'], heightRequest: height, tooltipText: tip[key],
                child: new Gtk.Image({iconName: Icon[key], iconSize: Gtk.IconSize.LARGE}),
            }));
        }).toSpliced(1, 0, area).forEach(x => this.append(x));
    }

    get dlg() {
        return (this.$dialog ??= T.seq(x => x.defaultFilter.add_pixbuf_formats(),
            new Gtk.FileDialog({modal: true, defaultFilter: new Gtk.FileFilter()})));
    }

    #onClick(title) {
        this.dlg.set_title(title);
        return this.dlg.open(this.get_root(), null);
    }

    #draw(_a, cr, w, h) {
        [DARK, LIGHT].forEach(key => {
            cr.save();
            try {
                Gdk.cairo_set_source_pixbuf(cr, GdkPixbuf.Pixbuf.new_from_file_at_scale(T.fopen(this[key]).get_path(), w, h, false), 0, 0);
            } catch(e) {
                logError(e);
                key === LIGHT ? cr.setSourceRGBA(0.9, 0.9, 0.9, 1) : cr.setSourceRGBA(0.2, 0.2, 0.2, 1);
            } finally {
                cr.moveTo(0, 0);
                cr.lineTo(w, h);
                key === LIGHT ? cr.lineTo(0, h) : cr.lineTo(w, 0);
                cr.clip();
                cr.paint();
            }
            cr.restore();
        });

        cr.$dispose();
    }
}

class UserThemeXPrefs extends UI.Page {
    static {
        T.enrol(this);
    }

    async $buildWidgets(gset) {
        let tip = {[LIGHT]: _('Day'), [DARK]: _('Night')},
            {gtk, shell, icon, cursor} = await Theme.getAllThemes(),
            paper = new Wallpaper(tip), theme = [],
            group = (h, d, f) => [[h, d], T.hook({clicked: () => this.$confirm(f, _('Reset all “%s” settings to default?').format(h))},
                new Gtk.Button({iconName: 'view-refresh-symbolic', tooltipText: _G('Reset'), hasFrame: false}))];
        this.$tie([
            [K.SHEET,  Sheet,  [_('_Stylesheet')]],
            [K.STYLE,  Style,  [_('S_tyle')]],
            [K.ICON,   icon,   [_('_Icon')]],
            [K.CURSOR, cursor, [_('_Cursor')]],
            [K.GTK,    gtk,    [_('_Legacy app')]],
            [K.SHELL,  shell,  [_('S_hell'), _('Never use with <a href="https://extensions.gnome.org/extension/19/user-themes/">user-theme</a> enabled')]],
            [K.COLOR,  Color,  [_('_Accent color')]],
        ].flatMap(([key, meta, title]) => T.seq(ws => theme.push(ws.map(w => w[1]).toSpliced(1, 0, title)),
            ['', LIGHT, DARK].map(x => [`${x}${key}`, x ? meta instanceof Function ? new meta(Icon[x], tip[x])
                : new ThemeDrop(meta, Icon[x], tip[x]) : new UI.Check()]))).sort(([a], [b]) => b.length - a.length));
        this.$add([group(_('Theme'), _('Switch according to the Night Light status'), () => Object.keys(this.$blk).forEach(x => gset.reset(x))), theme],
            [group(_('Wallpaper'), _('Switch according to the system Light/Dark style'), () => paper.$resetv()), [paper]]);
    }

    async $confirm(callback, heading) {
        let dlg = new Adw.AlertDialog({heading});
        dlg.add_response('cancel', _G('_Cancel'));
        dlg.add_response('ensure', _G('_OK'));
        dlg.set_response_appearance('ensure', Adw.ResponseAppearance.DESTRUCTIVE);
        if(await dlg.choose(this, null) === 'ensure') callback();
    }
}

export default class extends UI.Prefs { $klass = UserThemeXPrefs; }
