// SPDX-FileCopyrightText: tuberry
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Pango from 'gi://Pango';
import GObject from 'gi://GObject';
import GdkPixbuf from 'gi://GdkPixbuf';

import * as UI from './ui.js';
import * as T from './util.js';
import {Key as K, DARK, LIGHT} from './const.js';

import * as Theme from './theme.js';

const {_, _G} = UI;
const {$, $_, $$} = T;

Gio._promisify(Adw.AlertDialog.prototype, 'choose');

const Icon = {[LIGHT]: 'weather-clear-symbolic', [DARK]: 'weather-clear-night-symbolic'};
const Color = T.omap(Adw.AccentColor, ([k]) => (l => k !== l ? [[l, _G(T.upcase(l, T.id), 'libadwaita')]] : [])(k.toLowerCase()));
const Style = T.vmap({'default': 'No Preference', 'prefer-dark': 'Prefer Dark', 'prefer-light': 'Prefer Light'}, x => _G(x, 'libadwaita')); // from https://gitlab.gnome.org/GNOME/libadwaita/-/blob/main/src/adw-inspector-page.c

class ThemeLabel extends UI.Sign {
    static {
        T.enrol(this);
    }

    constructor(color, icon) {
        super(icon ?? 'object-select-symbolic', !icon, {useMarkup: true})[$_]
            .insert_child_after(color, color && (this.$color = new Gtk.Image()), icon ? this.$icon : null);
    }

    setup(dft, str, tran) {
        super.setup(null, dft ? `${tran(str)} <i>(${_G('Default')})</i>` : tran(str));
        let fill = Adw.AccentColor.to_rgba(Adw.AccentColor[str.toUpperCase()]).to_string();
        this.$color?.set_from_gicon(Gio.BytesIcon.new(T.encode(`<svg fill="${fill}" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32"/></svg>`)));
    }
}

class Sheet extends UI.File {
    static {
        T.enrol(this);
    }

    constructor(icon, tooltipText) {
        super({filter: {mimeTypes: ['text/css']}, open: true}, {tooltipText}, icon)[$]
            .set({setup: (_icon, text) => { super.setup(null, text); }});
        this.$btn.child.$label.set({maxWidthChars: 10,  ellipsize: Pango.EllipsizeMode.MIDDLE});
    }
}

class ThemeDrop extends Gtk.DropDown {
    static {
        UI.enrol(this, '');
    }

    constructor(data, icon, tip) {
        super({valign: Gtk.Align.CENTER, tooltipText: tip});
        let [strv, tran] = Array.isArray(data) ? [data, x => T.esc(T.upcase(x, T.id))] : [Object.keys(data), x => T.esc(data[x])];
        let setup = (x, {string: y}) => x.setup(y === this[UI.getv], y, tran);
        UI.once(() => this.#buildWidgets(strv, data === Color, setup, icon), this);
    }

    #buildWidgets(strv, color, setup, icon) {
        this[$]
            .set(strv.length > 9 ? {
                enableSearch: true, searchMatchMode: Gtk.StringFilterMatchMode.SUBSTRING,
                expression: new Gtk.PropertyExpression(Gtk.StringObject, null, 'string'),
            } : null)[$]
            .set_model(Gtk.StringList.new(strv))[$]
            .set_list_factory(new Gtk.SignalListItemFactory()[$$].connect([
                ['setup', (_f, x) => x.set_child(new ThemeLabel(color))],
                ['bind', (_f, {child, item}) => setup(child, item[$].$bind(this.bind_property_full('selected-item',
                    child.$icon, 'visible', GObject.BindingFlags.SYNC_CREATE, (_b, v) => [true, v === item], null)))],
                ['unbind', (_f, {item}) => item.$bind.unbind()],
            ]))[$].set_factory(new Gtk.SignalListItemFactory()[$$].connect([
                ['setup', (_f, x) => x.set_child(new ThemeLabel(color, icon))],
                ['bind', (_f, {child, item}) => setup(child, item)],
            ]))[$].bind_property_full('value', this, 'selected', T.BIND, (_b, v) => {
                let ret = this.model.get_n_items();
                do ret--; while(ret > -1 && v !== this.model.get_item(ret).string);
                return [ret !== -1, ret];
            }, (_b, v) => [v !== Gtk.INVALID_LIST_POSITION, this.model.get_item(v)?.string ?? ''])[$]
            .connect('unrealize', () => { this.list_factory = this.factory = null; }); // NOTE: workaround for https://gitlab.gnome.org/GNOME/gjs/-/issues/614
    }
}

class Wallpaper extends UI.Box {
    static {
        T.enrol(this, {[DARK]: '', [LIGHT]: ''});
    }

    constructor(tip, height = 270) {
        super();
        let width = height * 16 / 9,
            uri = [[LIGHT, 'picture-uri'], [DARK, 'picture-uri-dark']],
            gset = new Gio.Settings({schema: 'org.gnome.desktop.background'}),
            area = new Gtk.DrawingArea({widthRequest: width, heightRequest: height})[$].set_draw_func((...xs) => this.#draw(...xs));
        this[$].$resetv(() => uri.forEach(([, k]) => gset.reset(k)))[$$]
            .append(uri.map(([key, field]) => {
                gset.bind(field, this, key, Gio.SettingsBindFlags.DEFAULT);
                this.connect(`notify::${key}`, () => area.queue_draw());
                return new Gtk.Button({
                    cssClasses: ['suggested-action'], heightRequest: height, tooltipText: tip[key],
                    child: new Gtk.Image({iconName: Icon[key], iconSize: Gtk.IconSize.LARGE}),
                })[$].connect('clicked', () => this.#onClick(tip[key]).then(x => { this[key] = x.get_uri(); }).catch(T.nop));
            })[$].splice(1, 0, area));
    }

    get dlg() {
        return (this.$dialog ??= new Gtk.FileDialog({modal: true, defaultFilter: new Gtk.FileFilter()[$].add_pixbuf_formats()}));
    }

    #onClick(title) {
        return this.dlg[$].set_title(title).open(this.get_root(), null);
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
            group = (head, desc, reset) => [[head, desc], new Gtk.Button({iconName: 'view-refresh-symbolic', tooltipText: _G('Reset'), hasFrame: false})[$]
                .connect('clicked', () => this.$confirm(reset, _('Reset all “%s” settings to default?').format(head)))];
        this.$tie([
            [K.SHEET,  Sheet,  [_('_Stylesheet')]],
            [K.STYLE,  Style,  [_('S_tyle')]],
            [K.ICON,   icon,   [_('_Icon')]],
            [K.CURSOR, cursor, [_('_Cursor')]],
            [K.GTK,    gtk,    [_('_Legacy app')]],
            [K.SHELL,  shell,  [_('S_hell'), _('Never use with <a href="%s">user-theme</a> enabled').format('https://extensions.gnome.org/extension/19/user-themes/')]],
            [K.COLOR,  Color,  [_('_Accent color')]],
        ].flatMap(([key, meta, title]) => T.seq(['', LIGHT, DARK].map(x => [`${x}${key}`, x ? meta instanceof Function ? new meta(Icon[x], tip[x])
            : new ThemeDrop(meta, Icon[x], tip[x]) : new UI.Check()]), ws => theme.push(ws.map(w => w[1])[$].splice(1, 0, title)))).sort(([a], [b]) => b.length - a.length));
        this.$add([group(_('Theme'), _('Switch according to the inactive/active status of enabled Night Light'), () => Object.keys(this[T.hub]).forEach(x => gset.reset(x))), theme],
            [group(_('Wallpaper'), _('Switch according to the Default/Dark Style of system Appearance'), () => paper.$resetv()), [paper]]);
    }

    async $confirm(callback, heading) {
        callback[$_].call(await new Adw.AlertDialog({heading})[$$]
            .add_response([['cancel', _G('_Cancel')], ['ensure', _G('_OK')]])[$]
            .set_response_appearance('ensure', Adw.ResponseAppearance.DESTRUCTIVE)
            .choose(this, null) === 'ensure');
    }
}

export default class extends UI.Prefs { $klass = UserThemeXPrefs; }
