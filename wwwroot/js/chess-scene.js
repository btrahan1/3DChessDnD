// Finalized Babylon.js scene for ChessDnD
var scene;
var pieces = {}; // Map to store piece meshes by row_col
var selectionLight;
var spellModeActive = false;
var spellGlowLayer = null;

window.setSelectedPiece = (row, col) => {
    if (!scene) return;
    if (!selectionLight) {
        // Tight angle (Math.PI / 8) for a small pool of light, bright red for visibility
        selectionLight = new BABYLON.SpotLight("selectionLight", new BABYLON.Vector3(0, 5, 0), new BABYLON.Vector3(0, -1, 0), Math.PI / 8, 2, scene);
        selectionLight.diffuse = new BABYLON.Color3(1, 0, 0); 
        selectionLight.specular = new BABYLON.Color3(1, 0.2, 0.2);
        selectionLight.intensity = 4;
    }

    if (row === null || col === null) {
        selectionLight.setEnabled(false);
        return;
    }

    let key = row + "_" + col;
    let piece = pieces[key];
    if (piece) {
        selectionLight.position = piece.position.clone();
        selectionLight.position.y += 3;
        selectionLight.setDirectionToTarget(piece.position);
        selectionLight.setEnabled(true);
    } else {
        selectionLight.setEnabled(false);
    }
};

// setSpellMode: toggles a green glow on all pieces to indicate targeting
window.setSpellMode = (active) => {
    spellModeActive = active;
    // Change cursor to crosshair in spell mode
    document.getElementById("renderCanvas").style.cursor = active ? "crosshair" : "default";

    if (!spellGlowLayer) {
        spellGlowLayer = new BABYLON.GlowLayer("spellGlow", scene);
        spellGlowLayer.intensity = 0;
    }

    if (active) {
        spellGlowLayer.intensity = 1.2;
        // Animate the glow pulsing
        let t = 0;
        scene._spellGlowInterval = setInterval(() => {
            t += 0.1;
            spellGlowLayer.intensity = 0.6 + 0.6 * Math.sin(t);
        }, 50);
    } else {
        clearInterval(scene._spellGlowInterval);
        spellGlowLayer.intensity = 0;
    }
};

window.initBabylon = (dotNetRef) => {
    canvas = document.getElementById("renderCanvas");
    if (!canvas) {
        console.error("Canvas not found!");
        return;
    }
    
    engine = new BABYLON.Engine(canvas, true);
    window.dotNetRef = dotNetRef;
    
    scene = createScene();
    
    engine.runRenderLoop(function () {
        scene.render();
    });

    window.addEventListener("resize", function () {
        engine.resize();
    });

    // Initial piece placement - Properly distributed
    const setup = (row, color) => {
        addPieceMesh(row, 0, color, "Rook");
        addPieceMesh(row, 1, color, "Knight");
        addPieceMesh(row, 2, color, "Bishop");
        addPieceMesh(row, 3, color, "Queen");
        addPieceMesh(row, 4, color, "King");
        addPieceMesh(row, 5, color, "Bishop");
        addPieceMesh(row, 6, color, "Knight");
        addPieceMesh(row, 7, color, "Rook");
    };

    // White team (Rows 0 and 1)
    setup(0, "White");
    for(let i=0; i<8; i++) addPieceMesh(1, i, "White", "Pawn");

    // Black team (Rows 7 and 6)
    setup(7, "Black");
    for(let i=0; i<8; i++) addPieceMesh(6, i, "Black", "Pawn");
};

var createScene = function () {
    var scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.1, 1);

    var camera = new BABYLON.ArcRotateCamera("camera1", -Math.PI / 2, Math.PI / 3, 15, new BABYLON.Vector3(3.5, 0, 3.5), scene);
    camera.attachControl(canvas, true);

    var light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.5;

    var pointLight = new BABYLON.PointLight("pointLight", new BABYLON.Vector3(3.5, 5, 3.5), scene);
    pointLight.intensity = 0.8;

    // Create the board
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let square = BABYLON.MeshBuilder.CreateBox("sq_" + r + "_" + c, {width: 0.95, height: 0.2, depth: 0.95}, scene);
            square.position.x = r;
            square.position.z = c;
            
            let mat = new BABYLON.StandardMaterial("mat_" + r + "_" + c, scene);
            if ((r + c) % 2 === 0) {
                mat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.25);
            } else {
                mat.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.85);
            }
            square.material = mat;
            square.metadata = { row: r, col: c, type: "square" };
        }
    }

    scene.onPointerDown = function (evt, pickResult) {
        if (pickResult.hit && pickResult.pickedMesh && pickResult.pickedMesh.metadata) {
            let mesh = pickResult.pickedMesh;
            let row = mesh.metadata.row;
            let col = mesh.metadata.col;
            if (row !== undefined && col !== undefined && window.dotNetRef) {
                window.dotNetRef.invokeMethodAsync('OnSquareClick', row, col);
            }
        }
    };

    // Hover glow for spell targeting
    scene.onPointerMove = function (evt, pickResult) {
        if (!spellModeActive) return;
        // Reset all piece tints
        Object.values(pieces).forEach(p => {
            p.getChildMeshes().forEach(m => {
                if (m.material) m.material.emissiveColor = new BABYLON.Color3(0, 0, 0);
            });
        });
        if (pickResult.hit && pickResult.pickedMesh && pickResult.pickedMesh.metadata) {
            let mesh = pickResult.pickedMesh;
            // Highlight the hovered piece's root and children
            const key = mesh.metadata.row + "_" + mesh.metadata.col;
            const pieceRoot = pieces[key];
            if (pieceRoot) {
                pieceRoot.getChildMeshes().forEach(m => {
                    if (m.material) m.material.emissiveColor = new BABYLON.Color3(0, 0.7, 0.2);
                });
            }
        }
    };

    return scene;
};

window.addPieceMesh = async (row, col, color, type) => {
    if (!scene) return;
    
    // Load procedural model from JSON
    const pieceRoot = await window.ModelLoader.loadProceduralModel(scene, type, color, [row, 0.01, col]);
    pieceRoot.name = "piece_" + row + "_" + col;
    
    // Orientation: Face the opponent
    // Assuming pieces face "Forward" along one axis in the JSON, we rotate the root.
    pieceRoot.rotation.y = (color === "White") ? Math.PI / 2 : -Math.PI / 2;
    
    // Setup metadata for interaction on all child meshes
    const children = pieceRoot.getChildMeshes();
    children.forEach(m => {
        m.metadata = { row, col, color, type, isPiece: true };
        m.isPickable = true;
    });

    pieceRoot.metadata = { row, col, color, type, isPiece: true };
    pieces[row + "_" + col] = pieceRoot;
};

window.updatePiecePosition = (fromRow, fromCol, toRow, toCol) => {
    // If from and to are the same, the engine decided not to move (failed attack)
    if (fromRow === toRow && fromCol === toCol) return;

    let key = fromRow + "_" + fromCol;
    let piece = pieces[key];
    if (piece) {
        let destKey = toRow + "_" + toCol;
        if (pieces[destKey]) {
            pieces[destKey].dispose(false, true); // Recursive dispose for all children
            delete pieces[destKey];
        }

        BABYLON.Animation.CreateAndStartAnimation("move", piece, "position", 30, 15, 
            piece.position, new BABYLON.Vector3(toRow, 0.01, toCol), 
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        
        piece.metadata.row = toRow;
        piece.metadata.col = toCol;
        const children = piece.getChildMeshes();
        children.forEach(m => {
            if (m.metadata) {
                m.metadata.row = toRow;
                m.metadata.col = toCol;
            }
        });

        delete pieces[key];
        pieces[toRow + "_" + toCol] = piece;
    }
};

function updateHealthBar(piece) {
    const hp = piece.metadata.hp ?? 10;
    const maxHp = piece.metadata.maxHp ?? 10;
    const ratio = Math.max(0, hp / maxHp);

    let barBackground = piece.getChildren().find(c => c.name === "hp_bg_root");
    let barForeground;

    if (!barBackground) {
        barBackground = BABYLON.MeshBuilder.CreatePlane("hp_bg_root", { width: 0.8, height: 0.12 }, scene);
        barBackground.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        barBackground.position.y = 2.4; 
        barBackground.parent = piece;
        barBackground.material = new BABYLON.StandardMaterial("hp_bg_mat", scene);
        barBackground.material.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);

        barForeground = BABYLON.MeshBuilder.CreatePlane("hp_fg_bar", { width: 0.78, height: 0.1 }, scene);
        barForeground.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        barForeground.position.z = -0.01; 
        barForeground.parent = barBackground;
        barForeground.material = new BABYLON.StandardMaterial("hp_fg_mat", scene);
    } else {
        barForeground = barBackground.getChildren().find(c => c.name === "hp_fg_bar");
    }

    if (barForeground) {
        barForeground.scaling.x = ratio;
        barForeground.position.x = (1 - ratio) * -0.39;
        
        if (ratio < 0.3) barForeground.material.diffuseColor = new BABYLON.Color3(1, 0, 0);
        else if (ratio < 0.6) barForeground.material.diffuseColor = new BABYLON.Color3(1, 1, 0);
        else barForeground.material.diffuseColor = new BABYLON.Color3(0.2, 0.8, 0.2); // Clean Green
    }
}

window.syncGameState = (jsonState) => {
    const state = JSON.parse(jsonState);
    const activeKeys = new Set(state.map(p => p.Row + "_" + p.Col));

    state.forEach(p => {
        const key = p.Row + "_" + p.Col;
        const mesh = pieces[key];
        if (mesh) {
            mesh.metadata.hp = p.HP;
            mesh.metadata.maxHp = p.MaxHP;
            updateHealthBar(mesh);
        }
    });

    Object.keys(pieces).forEach(key => {
        if (!activeKeys.has(key)) {
            if (pieces[key]) {
                pieces[key].dispose(false, true); 
                delete pieces[key];
            }
        }
    });
};
