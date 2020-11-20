// vim:fdm=syntax
// by tuberry@github

const Main = imports.ui.main;
const { Gio, GObject } = imports.gi;
const LightProxy = Main.panel.statusArea['aggregateMenu']._nightLight._proxy;

const System = {
    SHELL:        'name',
    THEME:        'gtk-theme',
    ICONS:        'icon-theme',
    CURSOR:       'cursor-theme',
    NIGHTLIGHT:   'night-light-enabled',
    THEMESCHEMA:  'org.gnome.desktop.interface',
    NIGHTSCHEMA:  'org.gnome.settings-daemon.plugins.color',
};

const sgsettings = imports.misc.extensionUtils.getSettings();
const tgsettings = new Gio.Settings({ schema: System.THEMESCHEMA });
const ngsettings = new Gio.Settings({ schema: System.NIGHTSCHEMA });
const Type = { theme: 0, icons: 1, cursor: 2 };

const Fields = {
    GTK:         'gtk-x',
    ICONS:       'icons-x',
    SHELL:       'shell-x',
    CURSOR:      'cursor-x',
    GTKNIGHT:    'gtk-night-x',
    ICONSNIGHT:  'icons-night-x',
    SHELLNIGHT:  'shell-night-x',
    CURSORNIGHT: 'cursor-night-x',
};

var NightThemeSwitch = GObject.registerClass(
class NightThemeSwitch extends GObject.Object {
    _init() {
        super._init();
    }

    get _isNight() {
        if(!LightProxy || !ngsettings.get_boolean(System.NIGHTLIGHT))
            return false;
        return LightProxy.NightLightActive;
    }

    _onLightChanged() {
        if(this._isNight) {
            tgsettings.set_string(System.THEME, sgsettings.get_string(Fields.GTKNIGHT));
            sgsettings.set_string(System.SHELL, sgsettings.get_string(Fields.SHELLNIGHT));
            tgsettings.set_string(System.ICONS, sgsettings.get_string(Fields.ICONSNIGHT));
            tgsettings.set_string(System.CURSOR, sgsettings.get_string(Fields.CURSORNIGHT));
        } else {
            tgsettings.set_string(System.THEME, sgsettings.get_string(Fields.GTK));
            sgsettings.set_string(System.SHELL, sgsettings.get_string(Fields.SHELL));
            tgsettings.set_string(System.ICONS, sgsettings.get_string(Fields.ICONS));
            tgsettings.set_string(System.CURSOR, sgsettings.get_string(Fields.CURSOR));
        }
    }

    enable() {
        this._onLightChanged();
        this._proxyChangedId  = LightProxy.connect('g-properties-changed', this._onLightChanged.bind(this));
        this._nightLightOnId  = ngsettings.connect('changed::' + System.NIGHTLIGHT, this._onLightChanged.bind(this));

        this._eww();
    }

    _eww() { // sync values: 4 sys <=> 8 user
        this._themeChangedId  = tgsettings.connect('changed::' + System.THEME, () => {
            let key = this._isNight ? Fields.GTKNIGHT : Fields.GTK;
            if(sgsettings.get_string(key) != tgsettings.get_string(System.THEME))
                sgsettings.set_string(key, tgsettings.get_string(System.THEME));
        });
        this._iconsChangedId  = tgsettings.connect('changed::' + System.ICONS, () => {
            let key = this._isNight ? Fields.ICONSNIGHT : Fields.ICONS;
            if(sgsettings.get_string(key) != tgsettings.get_string(System.ICONS))
                sgsettings.set_string(key, tgsettings.get_string(System.ICONS));
        });
        this._cursorChangedId = tgsettings.connect('changed::' + System.CURSOR, () => {
            let key = this._isNight ? Fields.CURSORNIGHT : Fields.CURSOR;
            if(sgsettings.get_string(key) != tgsettings.get_string(System.CURSOR))
                sgsettings.set_string(key, tgsettings.get_string(System.CURSOR));
        });
        this._shellChangedID  = sgsettings.connect('changed::' + System.SHELL, () => {
            let key = this._isNight ? Fields.SHELLNIGHT : Fields.SHELL;
            if(sgsettings.get_string(key) != sgsettings.get_string(System.SHELL))
                sgsettings.set_string(key, sgsettings.get_string(System.SHELL));
        });

        this._gtkID = sgsettings.connect('changed::' + Fields.GTK, () => {
            if(this._isNight) return;
            if(tgsettings.get_string(System.THEME) != sgsettings.get_string(Fields.GTK))
                tgsettings.set_string(System.THEME, sgsettings.get_string(Fields.GTK));
        });
        this._shellID = sgsettings.connect('changed::' + Fields.SHELL, () => {
            if(this._isNight) return;
            if(sgsettings.get_string(System.SHELL) != sgsettings.get_string(Fields.SHELL))
                sgsettings.set_string(System.SHELL, sgsettings.get_string(Fields.SHELL))
        });
        this._iconsID = sgsettings.connect('changed::' + Fields.ICONS, () => {
            if(this._isNight) return;
            if(tgsettings.get_string(System.ICONS) != sgsettings.get_string(Fields.ICONS))
                tgsettings.set_string(System.ICONS, sgsettings.get_string(Fields.ICONS))
        });
        this._cursorID = sgsettings.connect('changed::' + Fields.CURSOR, () => {
            if(this._isNight) return;
            if(tgsettings.get_string(System.CURSOR) != sgsettings.get_string(Fields.CURSOR))
                tgsettings.set_string(System.CURSOR, sgsettings.get_string(Fields.CURSOR))
        });
        this._gtkNID = sgsettings.connect('changed::' + Fields.GTKNIGHT, () => {
            if(!this._isNight) return;
            if(tgsettings.get_string(System.THEME) != sgsettings.get_string(Fields.GTKNIGHT))
                tgsettings.set_string(System.THEME, sgsettings.get_string(Fields.GTKNIGHT));
        });
        this._shellNID = sgsettings.connect('changed::' + Fields.SHELLNIGHT, () => {
            if(!this._isNight) return;
            if(sgsettings.get_string(System.SHELL) != sgsettings.get_string(Fields.SHELLNIGHT))
                sgsettings.set_string(System.SHELL, sgsettings.get_string(Fields.SHELLNIGHT));
        });
        this._iconsNID = sgsettings.connect('changed::' + Fields.ICONSNIGHT, () => {
            if(!this._isNight) return;
            if(tgsettings.get_string(System.ICONS) != sgsettings.get_string(Fields.ICONSNIGHT))
                tgsettings.set_string(System.ICONS, sgsettings.get_string(Fields.ICONSNIGHT));
        });
        this._cursorNID = sgsettings.connect('changed::' + Fields.CURSORNIGHT, () => {
            if(!this._isNight) return;
            if(tgsettings.get_string(System.CURSOR) != sgsettings.get_string(Fields.CURSORNIGHT))
                tgsettings.set_string(System.CURSOR, sgsettings.get_string(Fields.CURSORNIGHT));
        });
    }

    disable() {
        if(this._nightLightOnId)
            ngsettings.disconnect(this._nightLightOnId), this._nightLightOnId = 0;
        if(this._themeChangedId)
            tgsettings.disconnect(this._themeChangedId), this._themeChangedId = 0;
        if(this._iconsChangedId)
            tgsettings.disconnect(this._iconsChangedId), this._iconsChangedId = 0;
        if(this._cursorChangedId)
            tgsettings.disconnect(this._cursorChangedId), this._cursorChangedId = 0;
        if(this._proxyChangedId)
            LightProxy.disconnect(this._proxyChangedId), this._proxyChangedId = 0;
        for(let x in this)
            if(RegExp(/^_.+ID$/).test(x)) eval('if(this.%s) sgsettings.disconnect(this.%s), this.%s = 0;'.format(x, x, x));

    }
});

