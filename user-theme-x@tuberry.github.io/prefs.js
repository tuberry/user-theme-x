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
            XGTK:         'gtk-x',
            XICONS:       'icons-x',
            XNIGHT:       'night-x',
            XSHELL:       'shell-x',
            XCURSOR:      'cursor-x',
            XGTKNIGHT:    'gtk-night-x',
            XSTYLE:       'stylesheet-x',
            XICONSNIGHT:  'icons-night-x',
            XSHELLNIGHT:  'shell-night-x',
            XCURSORNIGHT: 'cursor-night-x',
        }
    }

    _buildWidgets() {
        this._field_cursor       = this._comboMaker(Util.getCursorThemes());
        this._field_cursor_night = this._comboMaker(Util.getCursorThemes());
        this._field_icons        = this._comboMaker(Util.getIconThemes());
        this._field_icons_night  = this._comboMaker(Util.getIconThemes());
        this._field_gtk          = this._comboMaker(Util.getGtkThemes());
        this._field_gtk_night    = this._comboMaker(Util.getGtkThemes());
        this._field_shell        = this._comboMaker(Util.getShellThemes());
        this._field_shell_night  = this._comboMaker(Util.getShellThemes());
        this._field_night        = new Gtk.CheckButton({ label: "Autoswitch :" });
        this._field_style        = new Gtk.CheckButton({ label: "Load user stylesheet '~/.config/gnome-shell/gnome-shell{,-dark}.css'" });
    }

    _bindValues() {
        this._settings.bind(this.Fields.XNIGHT,       this._field_night,        'active',    Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(this.Fields.XSTYLE,       this._field_style,        'active',    Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(this.Fields.XCURSORNIGHT, this._field_cursor_night, 'active-id', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(this.Fields.XCURSOR,      this._field_cursor,       'active-id', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(this.Fields.XICONSNIGHT,  this._field_icons_night,  'active-id', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(this.Fields.XICONS,       this._field_icons,        'active-id', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(this.Fields.XSHELLNIGHT,  this._field_shell_night,  'active-id', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(this.Fields.XSHELL,       this._field_shell,        'active-id', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(this.Fields.XGTKNIGHT,    this._field_gtk_night,    'active-id', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(this.Fields.XGTK,         this._field_gtk,          'active-id', Gio.SettingsBindFlags.DEFAULT);
    }

    _buildUI() {
        let frame = this._listFrameMaker(_('Tweaks'), 0);
        frame._add(this._field_style);
        frame._add(this._field_night, this._labelMaker('Day', true), this._labelMaker('Night', true));
        frame._add(this._labelMaker('Gtk theme :'),   this._field_gtk,    this._field_gtk_night);
        frame._add(this._labelMaker('Shell theme :'), this._field_shell,  this._field_shell_night);
        frame._add(this._labelMaker('Icons theme :'),  this._field_icons,  this._field_icons_night);
        frame._add(this._labelMaker('Cursor theme :'),this._field_cursor, this._field_cursor_night);
    }

    _listFrameMaker(lbl, margin_top) {
        let frame = new Gtk.Frame({
            label_yalign: 1,
        });
        frame.set_label_widget(new Gtk.Label({
            use_markup: true,
            margin_top: margin_top,
            label: "<b><big>" + lbl + "</big></b>",
        }));
        this.add(frame);

        frame.grid = new Gtk.Grid({
            margin: 10,
            hexpand: true,
            row_spacing: 12,
            column_spacing: 18,
            row_homogeneous: false,
            column_homogeneous: false,
        });

        frame.grid._row = 0;
        frame.add(frame.grid);
        frame._add = (x, y, z) => {
            let r = frame.grid._row;
            if(z) {
                frame.grid.attach(x, 0, r, 1, 1);
                frame.grid.attach(y, 1, r, 1, 1);
                frame.grid.attach(z, 2, r, 1, 1);
            } else if(y) {
                frame.grid.attach(x, 0, r, 2, 1);
                frame.grid.attach(y, 2, r, 1, 1);
            } else {
                frame.grid.attach(x, 0, r, 3, 1);
            }
            frame.grid._row++;
        }
        return frame;
    }

    _syncStatus() {
        this._field_night.connect("notify::active", widget => {
            this._field_gtk.set_sensitive(widget.active);
            this._field_icons.set_sensitive(widget.active);
            this._field_shell.set_sensitive(widget.active);
            this._field_cursor.set_sensitive(widget.active);
            this._field_gtk_night.set_sensitive(widget.active);
            this._field_icons_night.set_sensitive(widget.active);
            this._field_shell_night.set_sensitive(widget.active);
            this._field_cursor_night.set_sensitive(widget.active)
        });
        this._field_gtk.set_sensitive(this._field_night.active);
        this._field_icons.set_sensitive(this._field_night.active);
        this._field_shell.set_sensitive(this._field_night.active);
        this._field_cursor.set_sensitive(this._field_night.active);
        this._field_gtk_night.set_sensitive(this._field_night.active);
        this._field_icons_night.set_sensitive(this._field_night.active);
        this._field_shell_night.set_sensitive(this._field_night.active);
        this._field_cursor_night.set_sensitive(this._field_night.active);
    }

    _comboMaker(ops) {
        let l = new Gtk.ListStore();
        l.set_column_types([GObject.TYPE_STRING]);
        ops.forEach(op => l.set(l.append(), [0], [op]));
        let c = new Gtk.ComboBox({ model: l });
        let r = new Gtk.CellRendererText({ editable: true, placeholder_text: 'Default' });
        c.pack_start(r, false);
        c.add_attribute(r, "text", 0);
        c.set_id_column(0);
        return c;
    }

    _labelMaker(x, y) {
        return new Gtk.Label({
            label: x,
            hexpand: true,
            use_markup: true,
            halign: y ? Gtk.Align.CENTER : Gtk.Align.END,
        });
    }
});
