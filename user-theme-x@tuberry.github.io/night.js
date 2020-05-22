// vim:fdm=syntax
// by tuberry@github

const Main = imports.ui.main;
const { Gio, GObject } = imports.gi;
const LightProxy = Main.panel.statusArea['aggregateMenu']._nightLight._proxy;

const Fields = {
    SHELL:       'name',
    THEME:       'gtk-theme',
    ICONS:       'icon-theme',
    CURSOR:      'cursor-theme',
    NIGHTLIGHT:  'night-light-enabled',
    THEMESCHEMA: 'org.gnome.desktop.interface',
    NIGHTSCHEMA: 'org.gnome.settings-daemon.plugins.color',
};

const sgsetting = imports.misc.extensionUtils.getSettings();
const tgsetting = new Gio.Settings({ schema: Fields.THEMESCHEMA });
const ngsetting = new Gio.Settings({ schema: Fields.NIGHTSCHEMA });

const Tweaks = {
    _icons:        'icons',
    _theme:        'theme',
    _cursor:       'cursor',
    _icons_night:  'icons-night',
    _theme_night:  'theme-night',
    _cursor_night: 'cursor-night',
};

var NightThemeSwitch = GObject.registerClass(
class NightThemeSwitch extends GObject.Object {
    _init() {
        super._init();
    }

    _onLightChanged() {
        if(!LightProxy || !ngsetting.get_boolean(Fields.NIGHTLIGHT)) return;
        if(LightProxy.NightLightActive) {
            let icons = this._icons.indexOf(tgsetting.get_string(Fields.ICONS));
            if(icons > -1 && this._icons_night[icons]) tgsetting.set_string(Fields.ICONS, this._icons_night[icons]);
            let cursor = this._cursor.indexOf(tgsetting.get_string(Fields.CURSOR));
            if(cursor > -1 && this._cursor_night[cursor]) tgsetting.set_string(Fields.CURSOR, this._cursor_night[cursor]);
            let theme = tgsetting.get_string(Fields.THEME);
            let index = this._theme.indexOf(theme);
            if(index < 0) {
                if(this._theme_night.includes(theme)) sgsetting.set_string(Fields.SHELL, theme.includes('Adwaita') ? '' : theme);
            } else {
                if(this._theme_night[index]) {
                    tgsetting.set_string(Fields.THEME, this._theme_night[index]);
                    sgsetting.set_string(Fields.SHELL, this._theme_night[index].includes('Adwaita') ? '' : this._theme_night[index]);
                }
            }
        } else {
            let icons = this._icons_night.indexOf(tgsetting.get_string(Fields.ICONS));
            if(icons > -1 && this._icons[icons]) tgsetting.set_string(Fields.ICONS, this._icons[icons]);
            let cursor = this._cursor_night.indexOf(tgsetting.get_string(Fields.CURSOR));
            if(cursor > -1 && this._cursor[cursor]) tgsetting.set_string(Fields.CURSOR, this._cursor[cursor]);
            let theme = tgsetting.get_string(Fields.THEME);
            let index = this._theme_night.indexOf(theme);
            if(index < 0) {
                if(this._theme.includes(theme)) sgsetting.set_string(Fields.SHELL, theme.includes('Adwaita') ? '' : theme);
            } else {
                if(this._theme[index]) {
                    tgsetting.set_string(Fields.THEME, this._theme[index]);
                    sgsetting.set_string(Fields.SHELL, this._theme[index].includes('Adwaita') ? '' : this._theme[index]);
                }
            }
        }
    }

    enable() {
        for(let x in Tweaks) {
            eval(`this.%s = sgsetting.get_string('%s') ? sgsetting.get_string('%s').split('#') : []`.format(x, Tweaks[x], Tweaks[x]));
            eval(`this.%sId = sgsetting.connect('changed::%s', () => { this.%s = sgsetting.get_string('%s') ? sgsetting.get_string('%s').split('#') : [];});`.format(x, Tweaks[x], x, Tweaks[x], Tweaks[x]));
        }
        this._onLightChanged();
        this._proxyChangedId  = LightProxy.connect('g-properties-changed', this._onLightChanged.bind(this));
        this._themeChangedId  = tgsetting.connect(`changed::${Fields.THEME}`, this._onLightChanged.bind(this));
        this._iconsChangedId  = tgsetting.connect(`changed::${Fields.ICONS}`, this._onLightChanged.bind(this));
        this._nightLightOnId  = ngsetting.connect(`changed::${Fields.NIGHTLIGHT}`, this._onLightChanged.bind(this));
        this._cursorChangedId = tgsetting.connect(`changed::${Fields.CURSOR}`, this._onLightChanged.bind(this));
    }

    disable() {
        if(this._nightLightOnId)
            ngsetting.disconnect(this._nightLightOnId), this._nightLightOnId = 0;
        if(this._themeChangedId)
            tgsetting.disconnect(this._themeChangedId), this._themeChangedId = 0;
        if(this._iconsChangedId)
            tgsetting.disconnect(this._iconsChangedId), this._iconsChangedId = 0;
        if(this._cursorChangedId)
            tgsetting.disconnect(this._cursorChangedId), this._cursorChangedId = 0;
        if(this._proxyChangedId)
            LightProxy.disconnect(this._proxyChangedId), this._proxyChangedId = 0;
        for(let x in Tweaks) {
            eval(`if(this.%sId) sgsetting.disconnect(this.%sId), this.%sId = 0;`.format(x, x, x));
            eval(`this.%s = null`.format(x));
        }
    }
});

