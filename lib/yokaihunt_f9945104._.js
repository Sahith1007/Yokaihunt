(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/yokaihunt/lib/phaser/GameScene.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GameScene",
    ()=>GameScene
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/yokaihunt/node_modules/@swc/helpers/esm/_define_property.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$phaser$2f$dist$2f$phaser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/yokaihunt/node_modules/phaser/dist/phaser.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$socket$2e$io$2d$client$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/yokaihunt/node_modules/socket.io-client/build/esm/index.js [app-client] (ecmascript) <locals>");
;
;
;
class GameScene extends __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$phaser$2f$dist$2f$phaser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Scene"] {
    init(data) {
        this.configData = {
            ...this.configData,
            ...data
        };
        if (this.configData.playerSpeed) this.playerSpeed = this.configData.playerSpeed;
    }
    preload() {
        // Generate a simple 2-tile spritesheet (grass, wall) programmatically
        const { tileSize } = this.configData;
        const width = tileSize * 2;
        const height = tileSize;
        const sheet = this.textures.createCanvas("tilesheet", width, height);
        const ctx = sheet.getContext();
        // Grass tile (index 0)
        ctx.fillStyle = "#2d6a4f";
        ctx.fillRect(0, 0, tileSize, tileSize);
        // sprinkle dots
        ctx.fillStyle = "#40916c";
        for(let i = 0; i < 30; i++){
            const x = Math.random() * (tileSize - 2);
            const y = Math.random() * (tileSize - 2);
            ctx.fillRect(x, y, 2, 2);
        }
        // Wall tile (index 1)
        ctx.fillStyle = "#6c757d";
        ctx.fillRect(tileSize, 0, tileSize, tileSize);
        ctx.strokeStyle = "#495057";
        for(let i = 0; i < tileSize; i += 4){
            ctx.beginPath();
            ctx.moveTo(tileSize, i + 0.5);
            ctx.lineTo(tileSize * 2, i + 0.5);
            ctx.stroke();
        }
        sheet.refresh();
        // Generate a player texture (circle)
        const g = this.make.graphics({
            x: 0,
            y: 0,
            add: false
        });
        g.fillStyle(0xffd166, 1);
        g.fillCircle(tileSize / 2, tileSize / 2, tileSize * 0.4);
        g.lineStyle(2, 0x073b4c, 1);
        g.strokeCircle(tileSize / 2, tileSize / 2, tileSize * 0.4);
        g.generateTexture("player", tileSize, tileSize);
        g.destroy();
    }
    create() {
        var _this_input_keyboard, _this_input_keyboard1;
        const { tileSize, mapWidth, mapHeight } = this.configData;
        // Create a blank tilemap and a dynamic layer using our generated spritesheet
        const map = this.make.tilemap({
            tileWidth: tileSize,
            tileHeight: tileSize,
            width: mapWidth,
            height: mapHeight
        });
        const tileset = map.addTilesetImage("tiles", "tilesheet", tileSize, tileSize, 0, 0);
        if (!tileset) throw new Error("Failed to create tileset from tilesheet");
        this.groundLayer = map.createBlankDynamicLayer("ground", tileset, 0, 0);
        // Fill ground (index 0) and carve walls (index 1) along the border + a few random obstacles
        this.groundLayer.fill(0, 0, 0, mapWidth, mapHeight);
        for(let x = 0; x < mapWidth; x++){
            this.groundLayer.putTileAt(1, x, 0);
            this.groundLayer.putTileAt(1, x, mapHeight - 1);
        }
        for(let y = 0; y < mapHeight; y++){
            this.groundLayer.putTileAt(1, 0, y);
            this.groundLayer.putTileAt(1, mapWidth - 1, y);
        }
        // random obstacles
        for(let i = 0; i < Math.floor(mapWidth * mapHeight * 0.05); i++){
            const rx = __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$phaser$2f$dist$2f$phaser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Math"].Between(1, mapWidth - 2);
            const ry = __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$phaser$2f$dist$2f$phaser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Math"].Between(1, mapHeight - 2);
            this.groundLayer.putTileAt(1, rx, ry);
        }
        // Enable collisions for wall tiles (index 1)
        this.groundLayer.setCollision(1, true);
        // Player setup
        this.player = this.physics.add.sprite(tileSize * 2, tileSize * 2, "player");
        this.player.setDepth(10);
        this.player.setCollideWorldBounds(true);
        // Camera and world bounds
        const worldWidth = mapWidth * tileSize;
        const worldHeight = mapHeight * tileSize;
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
        // Collide player with walls
        this.physics.add.collider(this.player, this.groundLayer);
        // Input
        this.cursors = (_this_input_keyboard = this.input.keyboard) === null || _this_input_keyboard === void 0 ? void 0 : _this_input_keyboard.createCursorKeys();
        this.wasd = (_this_input_keyboard1 = this.input.keyboard) === null || _this_input_keyboard1 === void 0 ? void 0 : _this_input_keyboard1.addKeys({
            W: __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$phaser$2f$dist$2f$phaser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"].Keyboard.KeyCodes.W,
            A: __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$phaser$2f$dist$2f$phaser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"].Keyboard.KeyCodes.A,
            S: __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$phaser$2f$dist$2f$phaser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"].Keyboard.KeyCodes.S,
            D: __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$phaser$2f$dist$2f$phaser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"].Keyboard.KeyCodes.D
        });
        // Multiplayer socket
        this.initMultiplayer();
    }
    update() {
        var _this_cursors_left, _this_cursors_right, _this_cursors_up, _this_cursors_down, _this_wasd, _this_wasd1, _this_wasd2, _this_wasd3;
        if (!this.player || !this.player.body) return;
        const speed = this.playerSpeed;
        let vx = 0;
        let vy = 0;
        // Arrow keys
        if ((_this_cursors_left = this.cursors.left) === null || _this_cursors_left === void 0 ? void 0 : _this_cursors_left.isDown) vx -= 1;
        if ((_this_cursors_right = this.cursors.right) === null || _this_cursors_right === void 0 ? void 0 : _this_cursors_right.isDown) vx += 1;
        if ((_this_cursors_up = this.cursors.up) === null || _this_cursors_up === void 0 ? void 0 : _this_cursors_up.isDown) vy -= 1;
        if ((_this_cursors_down = this.cursors.down) === null || _this_cursors_down === void 0 ? void 0 : _this_cursors_down.isDown) vy += 1;
        // WASD
        if ((_this_wasd = this.wasd) === null || _this_wasd === void 0 ? void 0 : _this_wasd.A.isDown) vx -= 1;
        if ((_this_wasd1 = this.wasd) === null || _this_wasd1 === void 0 ? void 0 : _this_wasd1.D.isDown) vx += 1;
        if ((_this_wasd2 = this.wasd) === null || _this_wasd2 === void 0 ? void 0 : _this_wasd2.W.isDown) vy -= 1;
        if ((_this_wasd3 = this.wasd) === null || _this_wasd3 === void 0 ? void 0 : _this_wasd3.S.isDown) vy += 1;
        const body = this.player.body;
        if (vx === 0 && vy === 0) {
            body.setVelocity(0, 0);
        } else {
            const len = Math.hypot(vx, vy) || 1;
            body.setVelocity(vx / len * speed, vy / len * speed);
        }
        // Throttled position sync
        const now = this.time.now;
        if (this.socket && now - this.lastSent > 100) {
            this.socket.emit("move", {
                x: this.player.x,
                y: this.player.y
            });
            this.lastSent = now;
        }
    }
    initMultiplayer() {
        if (this.socket) return; // already connected
        const socket = (0, __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$socket$2e$io$2d$client$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["io"])("http://localhost:4000", {
            transports: [
                "websocket"
            ],
            autoConnect: true
        });
        this.socket = socket;
        socket.on("connect", ()=>{
            this.myId = socket.id;
        });
        socket.on("initState", (payload)=>{
            // Create sprites for existing players (excluding self)
            Object.entries(payload.players).forEach((param)=>{
                let [id, pos] = param;
                if (id === this.myId) return;
                this.spawnOther(id, pos.x, pos.y);
            });
        });
        socket.on("playerJoined", (param)=>{
            let { id, x, y } = param;
            if (id === this.myId) return;
            this.spawnOther(id, x, y);
        });
        socket.on("playerMoved", (param)=>{
            let { id, x, y } = param;
            const sprite = this.others.get(id);
            if (sprite) {
                sprite.x = x;
                sprite.y = y;
            }
        });
        socket.on("playerLeft", (param)=>{
            let { id } = param;
            const sprite = this.others.get(id);
            if (sprite) {
                sprite.destroy();
                this.others.delete(id);
            }
        });
        // Cleanup on scene shutdown
        this.events.once(__TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$phaser$2f$dist$2f$phaser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Scenes"].Events.SHUTDOWN, ()=>{
            socket.removeAllListeners();
            socket.disconnect();
            this.socket = undefined;
            this.myId = undefined;
            this.others.forEach((s)=>{
                s.destroy();
            });
            this.others.clear();
        });
    }
    spawnOther(id, x, y) {
        const s = this.add.sprite(x, y, "player").setTint(0x118ab2);
        s.setDepth(5);
        this.others.set(id, s);
    }
    constructor(){
        super("GameScene"), (0, __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "cursors", void 0), (0, __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "wasd", void 0), (0, __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "player", void 0), (0, __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "groundLayer", void 0), (0, __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "configData", {
            tileSize: 32,
            mapWidth: 50,
            mapHeight: 38,
            playerSpeed: 200
        }), (0, __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "playerSpeed", 200), (0, __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "socket", void 0), (0, __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "myId", void 0), (0, __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "others", new Map()), (0, __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "lastSent", 0);
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/yokaihunt/components/Game.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Game
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/yokaihunt/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$phaser$2f$dist$2f$phaser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/yokaihunt/node_modules/phaser/dist/phaser.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/yokaihunt/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$lib$2f$phaser$2f$GameScene$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/yokaihunt/lib/phaser/GameScene.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
function Game(param) {
    let { width = 800, height = 600, className = "", tileSize = 32, mapWidth = 50, mapHeight = 38, playerSpeed = 200 } = param;
    _s();
    const gameRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const phaserGameRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Game.useEffect": ()=>{
            if (!gameRef.current) return;
            // Phaser game configuration
            const config = {
                type: __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$phaser$2f$dist$2f$phaser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AUTO"],
                width,
                height,
                parent: gameRef.current,
                backgroundColor: "#2c3e50",
                physics: {
                    default: "arcade",
                    arcade: {
                        gravity: {
                            x: 0,
                            y: 0
                        },
                        debug: false
                    }
                },
                scene: __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$lib$2f$phaser$2f$GameScene$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GameScene"],
                scale: {
                    mode: __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$phaser$2f$dist$2f$phaser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Scale"].FIT,
                    autoCenter: __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$phaser$2f$dist$2f$phaser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Scale"].CENTER_BOTH
                }
            };
            // Create the game instance
            phaserGameRef.current = new __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$phaser$2f$dist$2f$phaser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Game"](config);
            // Once created, (re)start the scene with props as data
            const startOrRestart = {
                "Game.useEffect.startOrRestart": ()=>{
                    const game = phaserGameRef.current;
                    const data = {
                        tileSize,
                        mapWidth,
                        mapHeight,
                        playerSpeed
                    };
                    const mgr = game.scene;
                    if (mgr.isActive("GameScene")) mgr.restart("GameScene", data);
                    else mgr.start("GameScene", data);
                }
            }["Game.useEffect.startOrRestart"];
            // Delay start until the game boots up
            if (phaserGameRef.current.isBooted) startOrRestart();
            else phaserGameRef.current.events.once(__TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$phaser$2f$dist$2f$phaser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Core"].Events.READY, startOrRestart);
            // Cleanup function
            return ({
                "Game.useEffect": ()=>{
                    if (phaserGameRef.current) {
                        phaserGameRef.current.destroy(true);
                        phaserGameRef.current = null;
                    }
                }
            })["Game.useEffect"];
        }
    }["Game.useEffect"], [
        width,
        height,
        tileSize,
        mapWidth,
        mapHeight,
        playerSpeed
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$yokaihunt$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: gameRef,
        className: "game-container ".concat(className),
        style: {
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
        }
    }, void 0, false, {
        fileName: "[project]/yokaihunt/components/Game.tsx",
        lineNumber: 83,
        columnNumber: 5
    }, this);
}
_s(Game, "GHkU7oDLvna8V3hb55+zAZQUaOI=");
_c = Game;
var _c;
__turbopack_context__.k.register(_c, "Game");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/yokaihunt/components/Game.tsx [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/yokaihunt/components/Game.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=yokaihunt_f9945104._.js.map