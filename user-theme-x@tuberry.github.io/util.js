// vim:fdm=syntax
// by: tuberry@github
'use strict';

/* *
 * exported getThemeDirs getModeThemeDirs
 * exported get{Gtk,Shell,Icons,Cursor}Themes
 * Refer to night-themes-switcher
 * https://gitlab.com/rmnvgr/nightthemeswitcher-gnome-shell-extension/-/blob/master/src/utils.js
 */
const { Gio, GLib, Gtk } = imports.gi;


const fn = (...args) => GLib.build_filenamev(args);

function getThemeDirs() {
    return [
        fn(GLib.get_home_dir(), '.themes'),
        fn(GLib.get_user_data_dir(), 'themes'),
        ...GLib.get_system_data_dirs().map(dir => fn(dir, 'themes')),
    ];
}

function getModeThemeDirs() {
    return GLib.get_system_data_dirs()
        .map(dir => fn(dir, 'gnome-shell', 'theme'));
}

function getDirs(type) {
    return [
        fn(GLib.get_home_dir(), `.${type}`),
        fn(GLib.get_user_data_dir(), type),
        ...GLib.get_system_data_dirs().map(dir => GLib.build_filenamev([dir, type])),
    ];
}

function getInstalled(type) {
    let installed = new Set();
    getDirs(type).forEach(path => {
        let dir = Gio.File.new_for_path(path);
        if (dir.query_file_type(Gio.FileQueryInfoFlags.NONE, null) !== Gio.FileType.DIRECTORY)
            return;
        let enumertor = dir.enumerate_children('', Gio.FileQueryInfoFlags.NONE, null);
        while (true) {
            let info = enumertor.next_file(null);
            if (info === null)
                break;
            let file = enumertor.get_child(info);
            if (file === null)
                break;
            let resource = new Map([
                ['name', file.get_basename()],
                ['path', file.get_path()],
            ]);
            installed.add(resource);
        }
        enumertor.close(null);
    });
    return installed;
}

function getGtkThemes() {
    let themes = new Set();
    getInstalled('themes').forEach(theme => {
        let version = [0, Gtk.MINOR_VERSION].find(gtkVersion => {
            if (gtkVersion % 2)
                gtkVersion += 1;
            let css = Gio.File.new_for_path(GLib.build_filenamev([theme.get('path'), `gtk-3.${gtkVersion}`, 'gtk.css']));
            return css.query_exists(null);
        });
        if (version !== undefined)
            themes.add(theme.get('name'));
    });
    return [...themes].sort();
}

function getModeThemes() {
    let themes = new Set();
    getModeThemeDirs().forEach(path => {
        let dir = Gio.File.new_for_path(path);
        if (dir.query_file_type(Gio.FileQueryInfoFlags.NONE, null) !== Gio.FileType.DIRECTORY)
            return;
        let enumertor = dir.enumerate_children('', Gio.FileQueryInfoFlags.NONE, null);
        while (true) {
            let info = enumertor.next_file(null);
            if (info === null)
                break;
            let file = enumertor.get_child(info);
            if (file === null)
                break;
            let filename = file.get_basename();
            if(!filename.endsWith('.css'))
                continue;
            themes.add(filename.slice(0, -4));
        }
        enumertor.close(null);
    });
    return themes;
}

function getShellThemes() {
    let themes = new Set();
    getInstalled('themes').forEach(theme => {
        let file = Gio.File.new_for_path(GLib.build_filenamev([theme.get('path'), 'gnome-shell', 'gnome-shell.css']));
        if (file.query_exists(null))
            themes.add(theme.get('name'));
    });
    getModeThemes().forEach(theme => themes.add(theme));
    themes.add('');
    return [...themes].sort();
}

function getIconThemes() {
    let themes = new Set();
    getInstalled('icons').forEach(theme => {
        let file = Gio.File.new_for_path(GLib.build_filenamev([theme.get('path'), 'icon-theme.cache']));
        if (file.query_exists(null))
            themes.add(theme.get('name'));
    });
    themes.delete('default');
    return [...themes].sort();
}

function getCursorThemes() {
    let themes = new Set();
    getInstalled('icons').forEach(theme => {
        let file = Gio.File.new_for_path(GLib.build_filenamev([theme.get('path'), 'cursors']));
        if (file.query_exists(null))
            themes.add(theme.get('name'));
    });
    return [...themes].sort();
}
