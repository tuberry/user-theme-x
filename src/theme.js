// vim:fdm=syntax
// by tuberry
/* exported getThemeDirs getModeThemeDirs getAllThemes */
'use strict';

const { GLib } = imports.gi;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const { noop, fn, fl, fexist, denum } = Me.imports.util;

function getDirs(type) {
    return [
        fn(GLib.get_home_dir(), `.${type}`),
        fn(GLib.get_user_data_dir(), type),
        ...GLib.get_system_data_dirs().map(dir => fn(dir, type)),
    ];
}

function getThemeDirs() {
    return getDirs('themes');
}

function getModeThemeDirs() {
    return GLib.get_system_data_dirs().map(dir => fn(dir, 'gnome-shell', 'theme'));
}

function enumerateDirs(dirs) {
    return Promise.all(dirs.map(async path => [...await denum(fl(path)).catch(noop) ?? []].map(x => ({ name: x.get_name(), path }))));
}

async function getThemes(type) {
    return (await enumerateDirs(getDirs(type))).flat().map(({ name, path }) => ({ name, path: `${path}/${name}` }));
}

async function getModeThemes() {
    return (await enumerateDirs(getModeThemeDirs())).flat().flatMap(({ name }) => name.endsWith('.css') ? [name.slice(0, -4)] : []);
}

async function getAllThemes() {
    let icons = await getThemes('icons'),
        themes = await getThemes('themes'),
        modes = await getModeThemes(),
        ret = await Promise.all([
            // Ref: https://gitlab.gnome.org/GNOME/gnome-tweaks/-/blob/master/gtweak/tweaks/tweak_group_appearance.py
            themes.map(async ({ path: x, name: y }) => await fexist(x, 'gtk-3.0', 'gtk.css').catch(noop) ? [y] : []).concat('HighContrastInverse'),
            themes.map(async ({ path: x, name: y }) => await fexist(x, 'gnome-shell', 'gnome-shell.css').catch(noop) ? [y] : []).concat(modes, 'Default'),
            icons.map(async ({ path: x, name: y }) => await fexist(x, 'icon-theme.cache') ? [y] : []),
            icons.map(async ({ path: x, name: y }) => await fexist(x, 'cursors') ? [y] : []),
        ].map(x => Promise.all(x)));
    return ret.map(x => [...new Set(x.flat())].sort());
}
