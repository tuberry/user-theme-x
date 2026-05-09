// SPDX-FileCopyrightText: tuberry
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gly from 'gi://Gly';
import Gsk from 'gi://Gsk';
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';
import GlyGtk4 from 'gi://GlyGtk4';

import * as UI from './ui.js';
import * as T from './util.js';
import {Key as K, DARK, LIGHT} from './const.js';

import * as Theme from './theme.js';

const {_, _G} = UI;
const {$, $_, $$, $s} = T;

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
        this.$color?.set_from_gicon(Gio.BytesIcon.new(T.encode(`<svg fill="${Adw.AccentColor.to_rgba(Adw.AccentColor[str.toUpperCase()])
.to_string()}" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32"/></svg>`)));
    }
}

class Sheet extends UI.File {
    static {
        T.enrol(this);
    }

    constructor(icon, tooltipText) {
        super({filter: {mimeTypes: ['text/css']}, open: true}, {tooltipText}, icon)[$]
            .set({setup: (icon_, text) => { this.$icon = icon_; super.setup(null, text); }});
        this.$btn.child.$label.set({maxWidthChars: 10, ellipsize: Pango.EllipsizeMode.MIDDLE});
    }

    $genDrag() {
        return super.$genDrag().with(0, UI.Icon.paintable(this.$icon));
    }
}

class ThemeDrop extends Gtk.DropDown {
    static {
        UI.enrol(this, '');
    }

    constructor(data, icon, tip) {
        super({valign: Gtk.Align.CENTER, tooltipText: tip});
        let [strv, tran] = Array.isArray(data) ? [data, x => T.esc(T.upcase(x, T.id))] : [Object.keys(data), x => T.esc(data[x])];
        let setup = (x, {string: y}) => x.setup(y === this[UI.dflt], y, tran);
        UI.once(() => this.$buildWidgets(strv, data === Color, setup, icon), this);
    }

    $buildWidgets(strv, color, setup, icon) {
        this[$]
            .set(strv.length > 9 ? {
                enableSearch: true, searchMatchMode: Gtk.StringFilterMatchMode.SUBSTRING,
                expression: new Gtk.PropertyExpression(Gtk.StringObject, null, 'string'),
            } : null)[$]
            .set_model(Gtk.StringList.new(strv))[$]
            .set_list_factory(new Gtk.SignalListItemFactory()[$s].connect([
                ['setup', (_f, x) => x.set_child(new ThemeLabel(color))],
                ['bind', (_f, {child, item}) => setup(child, item[$].$bind(this.bind_property_full('selected-item',
                    child.$icon, 'visible', T.SYNC, (_b, v) => [true, v === item], null)))],
                ['unbind', (_f, {item}) => item.$bind.unbind()],
            ]))[$].set_factory(new Gtk.SignalListItemFactory()[$s].connect([
                ['setup', (_f, x) => x.set_child(new ThemeLabel(color, icon))],
                ['bind', (_f, {child, item}) => setup(child, item)],
            ]))[$].bind_property_full(UI.getv, this, 'selected', T.BIND, (_b, v) => {
                let ret = this.model.get_n_items();
                do ret--; while(ret > -1 && v !== this.model.get_item(ret).string);
                return [ret !== -1, ret];
            }, (_b, v) => [v !== Gtk.INVALID_LIST_POSITION, this.model.get_item(v)?.string ?? ''])[$]
            .connect('unrealize', () => { this.list_factory = this.factory = null; }); // workaround for https://gitlab.gnome.org/GNOME/gjs/-/issues/614
    }
}

class Thumbnail extends Gtk.Widget {
    static {
        T.enrol(this, null, {Signals: {snapshot: {param_types: [Gtk.Snapshot.$gtype]}}});
    }

    vfunc_snapshot(snapshot) {
        this.emit('snapshot', snapshot);
    }
}

class Wallpaper extends UI.Box {
    static {
        T.enrol(this, {[DARK]: '', [LIGHT]: ''});
    }

    constructor(tip, width = 480) {
        super();
        let height = width * 9 / 16,
            uris = [[LIGHT, 'picture-uri'], [DARK, 'picture-uri-dark']],
            gset = new Gio.Settings({schema: 'org.gnome.desktop.background'}),
            area = new Thumbnail()[$].set({widthRequest: width, heightRequest: height})[$]
                .connect('snapshot', (...xs) => this.$draw(...xs))[$].add_controller(new Gtk.GestureClick()[$]
                .connect('pressed', (c_, n_, x, y) => this.$onClick(x * area.get_height() > y * area.get_width() ? DARK : LIGHT)));
        this[$].$tip(tip)[$].$resetv(() => uris.forEach(([, k]) => gset.reset(k)))[$s]
            .append(uris.map(([key, field]) => {
                gset.bind(field, this, key, Gio.SettingsBindFlags.DEFAULT);
                this.connect(`notify::${key}`, () => area.queue_draw());
                return new Gtk.Button({
                    cssClasses: ['suggested-action'], heightRequest: height, tooltipText: tip[key],
                    child: new Gtk.Image({iconName: Icon[key], iconSize: Gtk.IconSize.LARGE}),
                })[$].connect('clicked', () => this.$onClick(key));
            })[$].splice(1, 0, area));
    }

    get dlg() {
        return (this.$dialog ??= new Gtk.FileDialog({modal: true, defaultFilter: new Gtk.FileFilter()[$].add_pixbuf_formats()}));
    }

    $onClick(key) {
        return this.dlg[$].set_title(this.$tip[key]).open(this.get_root(), null).then(x => { this[key] = x.get_uri(); }).catch(T.nop);
    }

    $draw(area, ss) {
        let [, rect] = area.compute_bounds(area),
            {width: w, height: h} = rect.size,
            pb = new Gsk.PathBuilder();
        [DARK, LIGHT].forEach(uri => {
            pb.move_to(0, 0);
            pb.line_to(w, h);
            pb.line_to(...uri === DARK ? [w, 0] : [0, h]);
            ss.push_fill(pb.to_path(), Gsk.FillRule.WINDING);
            try {
                let frame = Gly.Loader.new(T.fopen(this[uri])).load().next_frame(); // unsandboxed -> https://docs.gtk.org/gdk4/ctor.Texture.new_from_file.html
                ss.append_scaled_texture(GlyGtk4.frame_get_texture(frame), Gsk.ScalingFilter.TRILINEAR, rect);
            } catch{
                ss.append_color(new Gdk.RGBA()[$].parse(uri === DARK ? '#222' : '#ddd'), rect);
            }
            ss.pop();
        });
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
        ].flatMap(([key, meta, title]) => ['', LIGHT, DARK].map(x => [`${x}${key}`, x ? meta instanceof Function ? new meta(Icon[x], tip[x])
            : new ThemeDrop(meta, Icon[x], tip[x]) : new UI.Check()])[$$](ws => theme.push(ws.map(w => w[1])[$].splice(1, 0, title)))).sort(([a], [b]) => b.length - a.length));
        this.$add([group(_('Theme'), _('Switch according to the inactive/active status of enabled Night Light'), () => Object.keys(this[T.hub]).forEach(x => gset.reset(x))), theme],
            [group(_('Wallpaper'), _('Switch according to the Default/Dark Style of system Appearance'), () => paper.$resetv()), [paper]]);
    }

    async $confirm(callback, heading) {
        callback[$_].call(await new Adw.AlertDialog({heading})[$s]
            .add_response([['cancel', _G('_Cancel')], ['ensure', _G('_OK')]])[$]
            .set_response_appearance('ensure', Adw.ResponseAppearance.DESTRUCTIVE)
            .choose(this, null) === 'ensure');
    }
}

export default class extends UI.Prefs { $klass = UserThemeXPrefs; }
