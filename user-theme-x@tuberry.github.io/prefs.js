// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-
/* exported init buildPrefsWidget */

// we use async/await here to not block the mainloop, not to parallelize
/* eslint-disable no-await-in-loop */

const { Gio, GLib, GObject, Gtk } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Util = Me.imports.util;
const _ = imports.gettext.domain(Me.metadata['gettext-domain']).gettext;

Gio._promisify(Gio._LocalFilePrototype,
    'enumerate_children_async', 'enumerate_children_finish');
Gio._promisify(Gio._LocalFilePrototype,
    'query_info_async', 'query_info_finish');
Gio._promisify(Gio.FileEnumerator.prototype,
    'next_files_async', 'next_files_finish');

const UserThemePrefsWidget = GObject.registerClass(
class UserThemePrefsWidget extends Gtk.ScrolledWindow {
    _init() {
        super._init({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
        });
        this._settings = ExtensionUtils.getSettings();

        const box = new Gtk.VBox();
        this.add(box);

        box.add(new ThemeTweaks());

        let frame = new Gtk.Frame({
            label_yalign: 1,
            margin: 30,
        });
        frame.set_label_widget(new Gtk.Label({
            use_markup: true,
            label: "<b><big>" + _('Shell Themes') + "</big></b>",
        }));
        box.add(frame);

        this._list = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.START,
            hexpand: true,
            margin: 10,
        });
        this._list.get_style_context().add_class('frame');
        this._list.set_header_func(this._updateHeader.bind(this));
        frame.add(this._list);

        this._actionGroup = new Gio.SimpleActionGroup();
        this._list.insert_action_group('theme', this._actionGroup);

        this._actionGroup.add_action(
            this._settings.create_action('name'));

        this.connect('destroy', () => this._settings.run_dispose());

        this._rows = new Map();
        this._addTheme(''); // default

        this._collectThemes();

    }

    async _collectThemes() {
        for (const dirName of Util.getThemeDirs()) {
            const dir = Gio.File.new_for_path(dirName);
            for (const name of await this._enumerateDir(dir)) {
                if (this._rows.has(name))
                    continue;

                const file = dir.resolve_relative_path(
                    `${name}/gnome-shell/gnome-shell.css`);
                try {
                    await file.query_info_async(
                        Gio.FILE_ATTRIBUTE_STANDARD_NAME,
                        Gio.FileQueryInfoFlags.NONE,
                        GLib.PRIORITY_DEFAULT, null);
                    this._addTheme(name);
                } catch (e) {
                    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                        logError(e);
                }
            }
        }

        for (const dirName of Util.getModeThemeDirs()) {
            const dir = Gio.File.new_for_path(dirName);
            for (const filename of await this._enumerateDir(dir)) {
                if (!filename.endsWith('.css'))
                    continue;

                const name = filename.slice(0, -4);
                if (!this._rows.has(name))
                    this._addTheme(name);
            }
        }
    }

    _addTheme(name) {
        const row = new ThemeRow(name);
        this._rows.set(name, row);

        this._list.add(row);
        row.show_all();
    }

    async _enumerateDir(dir) {
        const fileInfos = [];
        let fileEnum;

        try {
            fileEnum = await dir.enumerate_children_async(
                Gio.FILE_ATTRIBUTE_STANDARD_NAME,
                Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_DEFAULT, null);
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                logError(e);
            return [];
        }

        let infos;
        do {
            infos = await fileEnum.next_files_async(100,
                GLib.PRIORITY_DEFAULT, null);
            fileInfos.push(...infos);
        } while (infos.length > 0);

        return fileInfos.map(info => info.get_name());
    }

    _updateHeader(row, before) {
        if (!before || row.get_header())
            return;
        row.set_header(new Gtk.Separator());
    }
});

const ThemeRow = GObject.registerClass(
class ThemeRow extends Gtk.ListBoxRow {
    _init(name) {
        this._name = new GLib.Variant('s', name);

        super._init({
            action_name: 'theme.name',
            action_target: this._name,
        });

        const box = new Gtk.Box({
            spacing: 12,
            margin: 12,
        });
        this.add(box);

        box.add(new Gtk.Label({
            label: name || 'Default',
            hexpand: true,
            xalign: 0,
            max_width_chars: 25,
            width_chars: 25,
        }));

        this._checkmark = new Gtk.Image({
            icon_name: 'emblem-ok-symbolic',
            pixel_size: 16,
        });
        box.add(this._checkmark);

        box.show_all();

        const id = this.connect('parent-set', () => {
            this.disconnect(id);

            const actionGroup = this.get_action_group('theme');
            actionGroup.connect('action-state-changed::name',
                this._syncCheckmark.bind(this));
            this._syncCheckmark();
        });
    }

    _syncCheckmark() {
        const actionGroup = this.get_action_group('theme');
        const state = actionGroup.get_action_state('name');
        this._checkmark.opacity = this._name.equal(state);
    }
});

function init() {
}

function buildPrefsWidget() {
    let widget = new UserThemePrefsWidget();
    widget.show_all();

    return widget;
}


const ThemeTweaks = GObject.registerClass(
class ThemeTweaks extends Gtk.Box {
    _init() {
        super._init({
            margin: 30,
            orientation: Gtk.Orientation.VERTICAL,
        });

        this._initFields();
        this._buildWidgets();
        this._bindValues();
        this._buildUI();
        this._syncStatus();
        this.show_all();
    }

    _initFields() {
        this._settings = ExtensionUtils.getSettings();
        this.Fields = {
            ICONS:       'icons',
            NIGHT:       'night',
            THEME:       'theme',
            CURSOR:      'cursor',
            STYLE:       'stylesheet',
            ICONSNIGHT:  'icons-night',
            THEMENIGHT:  'theme-night',
            CURSORNIGHT: 'cursor-night',
        }
    }

    _buildWidgets() {
        this._field_cursor       = this._entryMaker('', _('Cursor theme'));
        this._field_cursor_night = this._entryMaker('', _('Cursor dark theme'));
        this._field_icons        = this._entryMaker('Papirus', _('Icon theme'));
        this._field_icons_night  = this._entryMaker('Papirus-Dark', _('Icon dark theme'));
        this._field_theme        = this._entryMaker('Adwaita#Materia', _('GTK/Shell theme'));
        this._field_theme_night  = this._entryMaker('Adwaita-dark#Materia-dark', _('GTK/Shell dark theme'));
        this._field_night        = new Gtk.CheckButton({ active: this._settings.get_boolean(this.Fields.NIGHT) });
        this._field_style        = new Gtk.CheckButton({ active: this._settings.get_boolean(this.Fields.STYLE) });
    }

    _bindValues() {
        this._settings.bind(this.Fields.CURSORNIGHT, this._field_cursor_night, 'text',   Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(this.Fields.CURSOR,      this._field_cursor,       'text',   Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(this.Fields.ICONSNIGHT,  this._field_icons_night,  'text',   Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(this.Fields.ICONS,       this._field_icons,        'text',   Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(this.Fields.NIGHT,       this._field_night,        'active', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(this.Fields.STYLE,       this._field_style,        'active', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(this.Fields.THEMENIGHT,  this._field_theme_night,  'text',   Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(this.Fields.THEME,       this._field_theme,        'text',   Gio.SettingsBindFlags.DEFAULT);
    }

    _buildUI() {
        let frame = new Gtk.Frame({
            label_yalign: 1,
        });
        frame.set_label_widget(new Gtk.Label({
            use_markup: true,
            margin_top: 30,
            label: "<b><big>" + _('Tweaks') + "</big></b>",
        }));
        this.add(frame);

        this._grid = new Gtk.Grid({
            margin: 10,
            hexpand: true,
            row_spacing: 12,
            column_spacing: 18,
            row_homogeneous: false,
            column_homogeneous: false,
        });
        frame.add(this._grid);
        let count = 0;

        this._grid.attach(this._labelMaker(this._field_style, _('Load user stylesheet from <small>~/.config/gnome-shell/gnome-shell.css</small>')), 0, count++, 1, 1);
        this._grid.attach(this._labelMaker(this._field_night, _('Enable night theme auto switch')), 0, count++, 1, 1);
        this._grid.attach(this._field_theme,        0, count++, 1, 1);
        this._grid.attach(this._field_theme_night,  0, count++, 1, 1);
        this._grid.attach(this._hboxMaker(this._field_icons, this._field_cursor), 0, count++, 1, 1);
        this._grid.attach(this._hboxMaker(this._field_icons_night, this._field_cursor_night), 0, count++, 1, 1);
    }

    _syncStatus() {
        this._field_night.connect("notify::active", widget => {
            this._field_icons.set_sensitive(widget.active);
            this._field_theme.set_sensitive(widget.active);
            this._field_icons_night.set_sensitive(widget.active);
            this._field_theme_night.set_sensitive(widget.active);
        });
        this._field_icons.set_sensitive(this._field_night.active);
        this._field_theme.set_sensitive(this._field_night.active);
        this._field_icons_night.set_sensitive(this._field_night.active);
        this._field_theme_night.set_sensitive(this._field_night.active);
    }

    _entryMaker(x, y) {
        return new Gtk.Entry({
            hexpand: true,
            placeholder_text: x,
            secondary_icon_sensitive: true,
            secondary_icon_tooltip_text: y,
            secondary_icon_activatable: true,
            secondary_icon_name: "dialog-information-symbolic",
        });
    }

    _hboxMaker(x, y) {
        let hbox = new Gtk.Box({ spacing: 10 });
        hbox.pack_start(x, true, true, 0);
        hbox.pack_end(y, true, true, 0);
        return hbox;
    }

    _labelMaker(x, y) {
        let hbox = new Gtk.Box();
        hbox.pack_start(x, false, false, 0);
        hbox.pack_start(new Gtk.Label({
            label: y,
            hexpand: true,
            margin_left: 10,
            use_markup: true,
            halign: Gtk.Align.START,
        }), true, true, 4);
        return hbox;
    }
});
