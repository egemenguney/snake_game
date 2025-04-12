const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.querySelector('.score-text');
const levelElement = document.querySelector('.level-text');
const modal = document.getElementById('nicknameModal');
const finalScore = document.getElementById('finalScore');
const nicknameInput = document.getElementById('nickname');
const submitButton = document.getElementById('submitScore');
const playAgainBtn = document.getElementById('playAgain');
const demoButton = document.getElementById('demoButton');
const leaderboardDiv = document.getElementById('leaderboard');
const closeLeaderboardBtn = document.getElementById('closeLeaderboard');
const showLeaderboardBtn = document.getElementById('showLeaderboard');
const API_BASE_URL = window.location.origin + '/api';

// Oyun ayarları
const tileCount = 20;
const gridSize = canvas.width / tileCount;
const baseSpeed = 8;

// Hareket yönleri
const GRID_DIRECTIONS = [
    { dx: 0, dy: -1 }, // up
    { dx: 1, dy: 0 },  // right
    { dx: 0, dy: 1 },  // down
    { dx: -1, dy: 0 }  // left
];

// Oyun durumu
let snake = [{ x: 10, y: 10 }];
let food = { x: 5, y: 5 };
let dx = 0;
let dy = 0;
let score = 0;
let foodCount = 0;
let speed = baseSpeed;
let gameStarted = false;
let gameLoop = null;
let isDemo = false;
let demoTimeout = null;
let foodType = 'apple';
let isGameOver = false;
let assetsLoaded = false;
let bombs = [];
let bombTimers = [];

// Game assets
const assets = {
    snakeHead: new Image(),
    snakeBody: new Image(),
    snakeDeadHead: new Image(),
    apple: new Image(),
    bomb: new Image(),
    easterEgg: new Image(),
    oliebol: new Image()
};

// Initialize assets
function initAssets() {
    // Set image sources
    assets.snakeHead.src = 'assets/png/snake_green_head.png';
    assets.snakeBody.src = 'assets/png/snake_green_blob.png';
    assets.snakeDeadHead.src = 'assets/png/snake_green_xx.png';
    assets.apple.src = 'assets/png/apple.png';
    assets.bomb.src = 'assets/png/bomb.png';
    assets.easterEgg.src = 'assets/png/easter_egg.png';
    assets.oliebol.src = 'assets/png/oliebol.png';
    
    // Add error handling for each image
    Object.values(assets).forEach(img => {
        img.onerror = function() {
            console.error(`Failed to load image: ${img.src}`);
            // Use fallback drawing if image fails to load
        };
    });
}

// Initialize game
function init() {
    console.log("Initializing game");
    
    // Initialize assets
    initAssets();
    
    // Set up event listeners
    setupEventListeners();
    
    // Wait for assets to load
    waitForAssets().then(() => {
        console.log("Assets loaded, game ready");
        assetsLoaded = true;
        
        // Generate food
        randomFood();
        
        // Draw initial state
        draw();
    }).catch(error => {
        console.error("Error loading assets:", error);
        // Continue with fallback rendering
        assetsLoaded = true;
        randomFood();
        draw();
    });
    
    console.log("Game initialization started");
}

// Wait for assets to load
function waitForAssets() {
    const promises = Object.values(assets).map(img => {
        return new Promise((resolve, reject) => {
            if (img.complete) {
                resolve();
            } else {
                img.onload = resolve;
                img.onerror = reject;
            }
        });
    });
    
    return Promise.all(promises);
}

// Draw game state with fallback for missing images
function draw() {
    // Clear canvas
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw snake
    snake.forEach((segment, index) => {
        if (index === 0) {
            // Draw head with rotation
            ctx.save();
            ctx.translate(segment.x * gridSize + gridSize/2, segment.y * gridSize + gridSize/2);
            
            // Calculate rotation based on direction
            let angle = 0;
            if (dx === 1) angle = Math.PI/2;
            if (dx === -1) angle = -Math.PI/2;
            if (dy === -1) angle = 0;
            if (dy === 1) angle = Math.PI;
            
            ctx.rotate(angle);
            
            // Draw the head with fallback
            const headImg = isGameOver ? assets.snakeDeadHead : assets.snakeHead;
            if (headImg.complete && headImg.naturalWidth !== 0) {
                ctx.drawImage(headImg, -gridSize/2, -gridSize/2, gridSize, gridSize);
            } else {
                // Fallback drawing if image fails to load
                ctx.fillStyle = isGameOver ? 'red' : 'green';
                ctx.fillRect(-gridSize/2, -gridSize/2, gridSize, gridSize);
                ctx.fillStyle = 'white';
                ctx.fillRect(-gridSize/4, -gridSize/4, gridSize/8, gridSize/8); // Eye
            }
            
            ctx.restore();
        } else {
            // Draw body with fallback
            if (assets.snakeBody.complete && assets.snakeBody.naturalWidth !== 0) {
                ctx.drawImage(assets.snakeBody, segment.x * gridSize, segment.y * gridSize, gridSize, gridSize);
            } else {
                ctx.fillStyle = '#00aa00';
                ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 2, gridSize - 2);
            }
        }
    });
    
    // Draw bombs with different states
    bombs.forEach(bomb => {
        if (bomb.exploded) {
            // Plus-shape explosion effect
            const explosionTiles = [
                {x: bomb.x, y: bomb.y},           // Center
                {x: bomb.x, y: bomb.y - 1},        // Up
                {x: bomb.x + 1, y: bomb.y},        // Right
                {x: bomb.x, y: bomb.y + 1},        // Down
                {x: bomb.x - 1, y: bomb.y}         // Left
            ];
            
            // Draw explosion tiles
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            explosionTiles.forEach(tile => {
                const x = (tile.x + tileCount) % tileCount;
                const y = (tile.y + tileCount) % tileCount;
                ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
            });
        } else if (bomb.exploding) {
            // Warning effect
            const flash = Math.floor(Date.now() / 100) % 2 === 0;
            
            const bombImg = assets.bomb;
            if (bombImg.complete && bombImg.naturalWidth !== 0) {
                ctx.drawImage(bombImg, bomb.x * gridSize, bomb.y * gridSize, gridSize, gridSize);
            } else {
                ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.arc(bomb.x * gridSize + gridSize/2, bomb.y * gridSize + gridSize/2, 
                    gridSize/2 - 2, 0, Math.PI * 2);
                ctx.fill();
            }
            
            if (flash) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                ctx.fillRect(bomb.x * gridSize, bomb.y * gridSize, gridSize, gridSize);
            }
        } else {
            // Normal bomb
            const bombImg = assets.bomb;
            if (bombImg.complete && bombImg.naturalWidth !== 0) {
                ctx.drawImage(bombImg, bomb.x * gridSize, bomb.y * gridSize, gridSize, gridSize);
            } else {
                ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.arc(bomb.x * gridSize + gridSize/2, bomb.y * gridSize + gridSize/2, 
                    gridSize/2 - 2, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Draw countdown
            const elapsed = (Date.now() - bomb.createdAt) / 1000;
            const remaining = Math.ceil(10 - elapsed);
            
            if (remaining <= 5) {
                ctx.fillStyle = remaining <= 3 ? 'red' : 'white';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(remaining.toString(), 
                    bomb.x * gridSize + gridSize/2, 
                    bomb.y * gridSize + gridSize/2 + 4);
            }
        }
    });
    
    // Draw food with fallback
    let foodImg;
    switch(foodType) {
        case 'apple': foodImg = assets.apple; break;
        case 'easterEgg': foodImg = assets.easterEgg; break;
        case 'oliebol': foodImg = assets.oliebol; break;
        default: foodImg = assets.apple;
    }
    
    if (foodImg.complete && foodImg.naturalWidth !== 0) {
        ctx.drawImage(foodImg, food.x * gridSize, food.y * gridSize, gridSize, gridSize);
    } else {
        // Fallback drawing if image fails to load
        ctx.fillStyle = foodType === 'apple' ? 'red' : 
                        foodType === 'easterEgg' ? 'purple' : 'orange';
        ctx.beginPath();
        ctx.arc(food.x * gridSize + gridSize/2, food.y * gridSize + gridSize/2, 
            gridSize/2 - 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Oyunu başlat
function startGame() {
    console.log("startGame called");
    if (!gameStarted) {
        gameStarted = true;
        
        // Başlangıç yönü (sağa doğru)
        dx = 1;
        dy = 0;
        
        // Oyun döngüsünü başlat
        if (gameLoop) clearInterval(gameLoop);
        gameLoop = setInterval(update, 1000 / speed);
        
        console.log("Game started with direction:", dx, dy);
    }
}

// Rastgele yiyecek oluştur
function randomFood() {
    // Add margin to prevent food from appearing at edges
    const margin = 1;
    
    let newFood;
    do {
        newFood = {
            x: Math.floor(Math.random() * (tileCount - 2*margin)) + margin,
            y: Math.floor(Math.random() * (tileCount - 2*margin)) + margin
        };
    } while (snake.some(segment => segment.x === newFood.x && segment.y === newFood.y) || 
             bombs.some(bomb => bomb.x === newFood.x && bomb.y === newFood.y));
    
    // Determine food type based on game progression
    const level = Math.floor(foodCount / 10) + 1;
    
    // Randomly select food type with increasing chances for special foods
    const rand = Math.random();
    
    if (level >= 3 && rand < 0.1) {
        foodType = 'easterEgg'; // double growth (10% chance at level 3+)
    } else if (level >= 2 && rand < 0.2) {
        foodType = 'oliebol'; // bonus points (20% chance at level 2+)
    } else {
        foodType = 'apple'; // regular food
    }
    
    // Add bomb obstacles at higher levels
    if (level >= 4 && !isGameOver && foodCount % 10 === 0) {
        isGameOver = true;
        addBombs(level - 3); // number of bombs scales with level
    }
    
    food = newFood;
    console.log(`New ${foodType} at:`, food.x, food.y);
}

// Çarpışma kontrolü
function checkCollision(head) {
    return snake.some((segment, index) => {
        // İlk segmenti (kafayı) atla
        return index > 0 && segment.x === head.x && segment.y === head.y;
    });
}

// Add a move queue to manage direction changes safely
let moveQueue = [];
const MAX_QUEUE_LENGTH = 2;

// Modify handleKeyDown function to use moveQueue
function handleKeyDown(e) {
    // Start game on arrow key press
    if (!gameStarted && e.key.startsWith('Arrow')) {
        startGame();
    }
    
    if (!gameStarted) return;

    const currentDirection = { dx, dy };
    let newDirection;

    // Determine new direction based on key
    switch(e.key) {
        case 'ArrowUp':
            newDirection = { dx: 0, dy: -1 };
            break;
        case 'ArrowDown':
            newDirection = { dx: 0, dy: 1 };
            break;
        case 'ArrowLeft':
            newDirection = { dx: -1, dy: 0 };
            break;
        case 'ArrowRight':
            newDirection = { dx: 1, dy: 0 };
            break;
        default:
            return; // Not an arrow key
    }

    // Only queue if it's a valid move (not directly opposite of current direction)
    if (isValidDirectionChange(currentDirection, newDirection)) {
        addToMoveQueue(newDirection);
    }
}

// Modify handleButtonClick to use moveQueue as well
function handleButtonClick(direction) {
    // Start game on first button click
    if (!gameStarted) {
        startGame();
    }
    
    if (!gameStarted || isDemo) return;

    const currentDirection = { dx, dy };
    let newDirection;

    // Determine new direction based on button
    switch(direction) {
        case 'up':
            newDirection = { dx: 0, dy: -1 };
            break;
        case 'down':
            newDirection = { dx: 0, dy: 1 };
            break;
        case 'left':
            newDirection = { dx: -1, dy: 0 };
            break;
        case 'right':
            newDirection = { dx: 1, dy: 0 };
            break;
    }

    // Only queue if it's a valid move
    if (isValidDirectionChange(currentDirection, newDirection)) {
        addToMoveQueue(newDirection);
    }
}

// Check if direction change is valid
function isValidDirectionChange(current, next) {
    // Cannot go in the opposite direction
    return !(current.dx + next.dx === 0 && current.dy + next.dy === 0);
}

// Add a move to the queue
function addToMoveQueue(direction) {
    // If queue is empty, check against current direction
    if (moveQueue.length === 0) {
        const currentDirection = { dx, dy };
        if (isValidDirectionChange(currentDirection, direction)) {
            moveQueue.push(direction);
        }
    } 
    // If queue has moves, check against the last queued move
    else if (moveQueue.length < MAX_QUEUE_LENGTH) {
        const lastDirection = moveQueue[moveQueue.length - 1];
        if (isValidDirectionChange(lastDirection, direction)) {
            moveQueue.push(direction);
        }
    }
}

// Modify update function to use the move queue
function update() {
    if (!gameStarted) return;

    // Process next move from queue
    if (moveQueue.length > 0) {
        const nextMove = moveQueue.shift();
        dx = nextMove.dx;
        dy = nextMove.dy;
    }

    // Calculate new head position
    const head = { 
        x: snake[0].x + dx, 
        y: snake[0].y + dy 
    };
    
    // Wall collision with wrapping
    if (head.x < 0) head.x = tileCount - 1;
    if (head.x >= tileCount) head.x = 0;
    if (head.y < 0) head.y = tileCount - 1;
    if (head.y >= tileCount) head.y = 0;

    // Self collision check - make sure to check only after the head has moved
    if (checkCollision(head)) {
        isGameOver = true;
        gameOver();
        return;
    }

    // Add new head
    snake.unshift(head);

    // Food collision check
    if (head.x === food.x && head.y === food.y) {
        let pointsGained = 10;
        let growthAmount = 1;
        
        // Special food effects
        switch(foodType) {
            case 'easterEgg':
                growthAmount = 2; // Double growth
                pointsGained = 15;
                break;
            case 'oliebol':
                pointsGained = 25; // Bonus points
                break;
        }
        
        // Apply effects
        score += pointsGained;
        foodCount++;
        
        // Keep the tail (don't pop for growth amount times)
        for (let i = 1; i < growthAmount; i++) {
            const tail = snake[snake.length - 1];
            snake.push({...tail}); // Add a copy of the tail
        }
        
        // Level progression
        if (Math.floor(foodCount / 10) > Math.floor(foodCount / 10)) {
            speed = baseSpeed + Math.floor(foodCount / 10) * 2;
            clearInterval(gameLoop);
            gameLoop = setInterval(update, 1000 / speed);
        }
        
        updateScoreDisplay();
        randomFood();
    } else {
        // Remove tail if no food was eaten
        snake.pop();
    }

    draw();
}

// Oyun bittiğinde
function gameOver() {
    if (isDemo) {
        stopDemo();
        return;
    }
    
    console.log("Game over!");
    clearInterval(gameLoop);
    gameLoop = null;
    gameStarted = false;
    
    // Stop snake movement
    dx = 0;
    dy = 0;
    
    // Draw the final state with dead head
    draw();
    
    // Show score and modal
    const level = Math.floor(foodCount / 10) + 1;
    finalScore.innerHTML = `
        <span class="score-text">Score: ${score}</span>
        <span class="level-text">Level: ${level}</span>
    `;
    
    // Show modal
    setTimeout(() => {
        modal.style.display = 'block';
    }, 500); // Small delay to let player see the dead snake
}

// Oyunu sıfırla
function resetGame() {
    console.log("Game reset");
    clearTimeout(demoTimeout);
    clearInterval(gameLoop);
    gameLoop = null;
    snake = [{ x: 10, y: 10 }];
    dx = 0;
    dy = 0;
    score = 0;
    foodCount = 0;
    speed = baseSpeed;
    gameStarted = false;
    isGameOver = false;
    foodType = 'apple';
    powerups = [];
    bombs = [];
    bombTimers = [];
    updateScoreDisplay();
    randomFood();
    draw();
    
    // Reset the move queue
    moveQueue = [];
}

// Skoru güncelle
function updateScoreDisplay() {
    const level = Math.floor(foodCount / 10) + 1;
    document.querySelector('.score-text').textContent = `Score: ${score}`;
    document.querySelector('.level-text').textContent = `Level: ${level}`;
}

// Tuş kontrolü
function handleKeyDown(e) {
    console.log("Key pressed:", e.key);
    
    if (!gameStarted && e.key.startsWith('Arrow')) {
        startGame();
    }
    
    if (!gameStarted) return;

    switch(e.key) {
        case 'ArrowUp':
            if (dy !== 1) { // Aşağıya gidiyorsa yukarı gidemez
                dx = 0;
                dy = -1;
            }
            break;
        case 'ArrowDown':
            if (dy !== -1) { // Yukarı gidiyorsa aşağı gidemez
                dx = 0;
                dy = 1;
            }
            break;
        case 'ArrowLeft':
            if (dx !== 1) { // Sağa gidiyorsa sola gidemez
                dx = -1;
                dy = 0;
            }
            break;
        case 'ArrowRight':
            if (dx !== -1) { // Sola gidiyorsa sağa gidemez
                dx = 1;
                dy = 0;
            }
            break;
    }
}

// Buton kontrolü
function handleButtonClick(direction) {
    console.log("Button clicked:", direction);
    
    if (!gameStarted) {
        startGame();
    }
    
    if (!gameStarted || isDemo) return;

    switch(direction) {
        case 'up':
            if (dy !== 1) {
                dx = 0;
                dy = -1;
            }
            break;
        case 'down':
            if (dy !== -1) {
                dx = 0;
                dy = 1;
            }
            break;
        case 'left':
            if (dx !== 1) {
                dx = -1;
                dy = 0;
            }
            break;
        case 'right':
            if (dx !== -1) {
                dx = 1;
                dy = 0;
            }
            break;
    }
}

// Simplified demo mode functions
function startDemo() {
    console.log("Starting demo mode");
    
    // First, completely reset the game
    resetGame();
    
    // Set demo flag
    isDemo = true;
    
    // Update button appearance
    demoButton.innerHTML = '<i class="fas fa-stop"></i> Demo';
    demoButton.classList.add('active');
    
    // Start from a good position
    snake = [{ x: 5, y: 5 }];
    dx = 1; // Start moving right
    dy = 0;
    
    // Add some bombs for demonstration
    addBombs(2);
    
    // Start the game
    gameStarted = true;
    
    // Clear any existing game loop and start a new one
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(update, 1000 / speed);
    
    // Start the demo AI
    if (demoTimeout) clearTimeout(demoTimeout);
    demoTimeout = setTimeout(runDemoMove, 100);
    
    console.log("Demo started with snake at", snake[0].x, snake[0].y);
}

function stopDemo() {
    console.log("Stopping demo mode");
    
    // Clear demo timeout
    if (demoTimeout) {
        clearTimeout(demoTimeout);
        demoTimeout = null;
    }
    
    // Reset demo flag
    isDemo = false;
    
    // Update button appearance
    demoButton.innerHTML = '<i class="fas fa-play"></i> Demo';
    demoButton.classList.remove('active');
    
    // Reset the game
    resetGame();
    
    console.log("Demo stopped");
}

function runDemoMove() {
    if (!isDemo || !gameStarted) {
        console.log("Demo mode inactive, not running move");
        return;
    }
    
    // Get the current head position
    const head = snake[0];
    console.log("Demo snake head at", head.x, head.y);
    
    // Find the best move
    const nextMove = findSimpleDemoMove(head);
    console.log("Demo choosing move", nextMove.dx, nextMove.dy);
    
    // Apply the move
    dx = nextMove.dx;
    dy = nextMove.dy;
    
    // Schedule next move
    demoTimeout = setTimeout(runDemoMove, 150);
}

// Simple and reliable AI for demo mode
function findSimpleDemoMove(head) {
    // Get safe moves (don't hit snake or bombs)
    const safeMoves = [
        { dx: 1, dy: 0 },  // right
        { dx: 0, dy: 1 },  // down
        { dx: -1, dy: 0 }, // left
        { dx: 0, dy: -1 }  // up
    ].filter(move => {
        // Can't reverse direction
        if ((move.dx === -dx && move.dy === -dy) && (dx !== 0 || dy !== 0)) {
            return false;
        }
        
        // Calculate next position with wrapping
        const nextX = (head.x + move.dx + tileCount) % tileCount;
        const nextY = (head.y + move.dy + tileCount) % tileCount;
        
        // Check for snake collision (except tail which will move)
        const hitSnake = snake.some((segment, index) => {
            // Ignore tail if we're not growing
            if (index === snake.length - 1 && 
                !(head.x === food.x && head.y === food.y)) {
                return false;
            }
            return index > 0 && segment.x === nextX && segment.y === nextY;
        });
        
        // Check for bomb collision
        const hitBomb = bombs.some(bomb => 
            bomb.x === nextX && bomb.y === nextY
        );
        
        return !hitSnake && !hitBomb;
    });
    
    console.log("Safe moves:", safeMoves.length);
    
    // If no safe moves, try any move that doesn't immediately kill us
    if (safeMoves.length === 0) {
        console.log("No safe moves, using current direction");
        return { dx, dy };
    }
    
    // Sort moves by distance to food
    safeMoves.sort((a, b) => {
        const posA = {
            x: (head.x + a.dx + tileCount) % tileCount,
            y: (head.y + a.dy + tileCount) % tileCount
        };
        
        const posB = {
            x: (head.x + b.dx + tileCount) % tileCount,
            y: (head.y + b.dy + tileCount) % tileCount
        };
        
        // Manhattan distance to food
        const distA = Math.abs(posA.x - food.x) + Math.abs(posA.y - food.y);
        const distB = Math.abs(posB.x - food.x) + Math.abs(posB.y - food.y);
        
        return distA - distB;
    });
    
    // Return the move that gets us closest to food
    return safeMoves[0];
}

// Make sure addBombs function is correctly defined
function addBombs(count) {
    for (let i = 0; i < count; i++) {
        let bombPos;
        let attempts = 0;
        
        do {
            bombPos = {
                x: Math.floor(Math.random() * tileCount),
                y: Math.floor(Math.random() * tileCount)
            };
            attempts++;
            
            // Give up after too many attempts
            if (attempts > 20) break;
            
        } while (
            snake.some(segment => segment.x === bombPos.x && segment.y === bombPos.y) ||
            (bombPos.x === food.x && bombPos.y === food.y) ||
            bombs.some(bomb => bomb.x === bombPos.x && bomb.y === bombPos.y)
        );
        
        if (attempts <= 20) {
            // Add bomb with timer
            const newBomb = {
                x: bombPos.x,
                y: bombPos.y,
                createdAt: Date.now(),
                exploding: false,
                exploded: false
            };
            
            bombs.push(newBomb);
            
            // Set timer for bomb explosion (10 seconds)
            const bombTimer = setTimeout(() => {
                triggerBombExplosion(newBomb);
            }, 10000);
            
            bombTimers.push(bombTimer);
        }
    }
}

// Update bomb explosion to plus shape
function triggerBombExplosion(bomb) {
    if (!bomb || bomb.exploded) return;
    
    // Mark bomb as exploding
    bomb.exploding = true;
    
    // Update visual to show exploding bomb
    draw();
    
    // Set timer for full explosion (1 second after warning)
    setTimeout(() => {
        if (!bomb || bomb.exploded) return;
        
        // Mark bomb as exploded
        bomb.exploded = true;
        
        // Check if snake is in explosion radius (plus shape)
        checkPlusShapeExplosionDamage(bomb);
        
        // Remove the bomb after explosion
        setTimeout(() => {
            bombs = bombs.filter(b => b !== bomb);
            draw();
        }, 500);
        
    }, 1000);
}

// Check if explosion damages the snake (plus shape only)
function checkPlusShapeExplosionDamage(bomb) {
    // Plus shape explosion - only directly adjacent tiles (up, down, left, right)
    const explosionTiles = [
        {x: bomb.x, y: bomb.y},           // Center (bomb itself)
        {x: bomb.x, y: bomb.y - 1},        // Up
        {x: bomb.x + 1, y: bomb.y},        // Right
        {x: bomb.x, y: bomb.y + 1},        // Down
        {x: bomb.x - 1, y: bomb.y}         // Left
    ];
    
    // Handle wrapping for explosion tiles
    const wrappedExplosionTiles = explosionTiles.map(tile => ({
        x: (tile.x + tileCount) % tileCount,
        y: (tile.y + tileCount) % tileCount
    }));
    
    // Check each snake segment
    for (let i = 0; i < snake.length; i++) {
        const segment = snake[i];
        
        // Check if segment is in any explosion tile
        if (wrappedExplosionTiles.some(tile => 
            tile.x === segment.x && tile.y === segment.y)) {
            isGameOver = true;
            gameOver();
            return;
        }
    }
}

// Liderlik tablosunu güncelle
async function updateLeaderboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/scores`);
        if (!response.ok) {
            throw new Error('Failed to fetch leaderboard');
        }
        
        const scores = await response.json();
        const leaderboardList = document.getElementById('leaderboardList');
        
        if (!scores || scores.length === 0) {
            leaderboardList.innerHTML = '<div class="leaderboard-item">No scores yet</div>';
            return;
        }

        scores.sort((a, b) => b.score - a.score);
        const topScores = scores.slice(0, 10);

        leaderboardList.innerHTML = topScores.map((score, index) => `
            <div class="leaderboard-item">
                <span class="leaderboard-rank">#${index + 1}</span>
                <span class="leaderboard-name">${score.nickname}</span>
                <div class="score-info">
                    <span class="score-value">${score.score}</span>
                    <span class="score-stage">Level ${score.stage} </span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error updating leaderboard:', error);
        document.getElementById('leaderboardList').innerHTML = '<div class="leaderboard-item">Error loading scores</div>';
    }
}

// Skoru gönder
async function submitScore(nickname) {
    try {
        const response = await fetch(`${API_BASE_URL}/scores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                nickname: nickname,
                score: score,
                stage: Math.floor(foodCount / 10) + 1
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to submit score');
        }

        return response.json();
    } catch (error) {
        console.error('Score submission error:', error);
        throw error;
    }
}

// Skor gönderme işleyicisi
function handleScoreSubmission() {
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
        alert('Please enter a nickname');
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    submitScore(nickname)
        .then(() => {
            modal.style.display = 'none';
            updateLeaderboard();
        })
        .catch(error => {
            console.error('Score submission failed:', error);
            alert('Failed to submit score: ' + error.message);
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Score';
        });
}

// Add bomb obstacles
function addBombObstacles(count) {
    // Clear existing bombs
    powerups = powerups.filter(pu => pu.type !== 'bomb');
    
    // Add new bombs
    for (let i = 0; i < count; i++) {
        let bombPos;
        do {
            bombPos = {
                x: Math.floor(Math.random() * tileCount),
                y: Math.floor(Math.random() * tileCount),
                type: 'bomb'
            };
        } while (
            (bombPos.x === food.x && bombPos.y === food.y) || 
            snake.some(segment => segment.x === bombPos.x && segment.y === bombPos.y) ||
            powerups.some(pu => pu.x === bombPos.x && pu.y === bombPos.y)
        );
        
        powerups.push(bombPos);
    }
}

// Create control areas that stick to the inner edges of gameplay section
function createInGameControls() {
    const gameplaySection = document.querySelector('.gameplay-section');
    
    if (!gameplaySection) return;
    
    // Create container
    const inGameControls = document.createElement('div');
    inGameControls.className = 'in-game-controls';
    
    // Create areas for each direction taking up entire edges
    const directions = [
        {name: 'up', position: 'top'},
        {name: 'right', position: 'right'},
        {name: 'down', position: 'bottom'},
        {name: 'left', position: 'left'}
    ];
    
    directions.forEach(dir => {
        const area = document.createElement('div');
        area.id = `game${dir.name.charAt(0).toUpperCase() + dir.name.slice(1)}Area`;
        area.className = 'game-control-area';
        
        // Touch events for mobile
        area.addEventListener('touchstart', (e) => {
            e.preventDefault();
            area.classList.add('active');
            handleButtonClick(dir.name);
        });
        
        area.addEventListener('touchend', (e) => {
            e.preventDefault();
            area.classList.remove('active');
        });
        
        // Mouse events for testing
        area.addEventListener('mousedown', () => {
            area.classList.add('active');
            handleButtonClick(dir.name);
        });
        
        area.addEventListener('mouseup', () => {
            area.classList.remove('active');
        });
        
        inGameControls.appendChild(area);
    });
    
    gameplaySection.appendChild(inGameControls);
    console.log("Edge-attached control areas created");
}

// Create mobile controls for gameplay section
function createMobileControls() {
    const gameplaySection = document.querySelector('.gameplay-section');
    if (!gameplaySection) return;
    
    // Create mobile controls container
    const mobileControls = document.createElement('div');
    mobileControls.className = 'mobile-controls';
    
    // Create swipe area
    const swipeArea = document.createElement('div');
    swipeArea.className = 'swipe-area';
    
    // Create direction indicators
    const directions = [
        {name: 'up', icon: 'fa-chevron-up', class: 'indicator-up'},
        {name: 'right', icon: 'fa-chevron-right', class: 'indicator-right'},
        {name: 'down', icon: 'fa-chevron-down', class: 'indicator-down'},
        {name: 'left', icon: 'fa-chevron-left', class: 'indicator-left'}
    ];
    
    // Create indicators
    const indicators = {};
    directions.forEach(dir => {
        const indicator = document.createElement('div');
        indicator.className = `direction-indicator ${dir.class}`;
        indicator.innerHTML = `<i class="fas ${dir.icon}"></i>`;
        mobileControls.appendChild(indicator);
        indicators[dir.name] = indicator;
    });
    
    // Add swipe handling
    let touchStartX = 0;
    let touchStartY = 0;
    let lastDirection = null;
    
    swipeArea.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    });
    
    swipeArea.addEventListener('touchmove', (e) => {
        if (!gameStarted && !isDemo) {
            startGame();
        }
        
        if (!gameStarted) return;
        
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        
        const diffX = touchX - touchStartX;
        const diffY = touchY - touchStartY;
        
        // Determine swipe direction with threshold
        let direction = null;
        const threshold = 20;
        
        if (Math.abs(diffX) > Math.abs(diffY)) {
            // Horizontal swipe
            if (Math.abs(diffX) > threshold) {
                direction = diffX > 0 ? 'right' : 'left';
            }
        } else {
            // Vertical swipe
            if (Math.abs(diffY) > threshold) {
                direction = diffY > 0 ? 'down' : 'up';
            }
        }
        
        // If direction changed, handle it
        if (direction && direction !== lastDirection) {
            lastDirection = direction;
            handleButtonClick(direction);
            
            // Show indicator for the direction
            Object.values(indicators).forEach(ind => ind.classList.remove('show'));
            if (indicators[direction]) {
                indicators[direction].classList.add('show');
                setTimeout(() => {
                    indicators[direction].classList.remove('show');
                }, 500);
            }
        }
    });
    
    swipeArea.addEventListener('touchend', () => {
        lastDirection = null;
    });
    
    // Alternative: Add tap zones for directional movement
    const tapZoneSize = '33%';
    const tapZones = [
        {name: 'up', style: {top: 0, left: tapZoneSize, width: tapZoneSize, height: tapZoneSize}},
        {name: 'right', style: {top: tapZoneSize, right: 0, width: tapZoneSize, height: tapZoneSize}},
        {name: 'down', style: {bottom: 0, left: tapZoneSize, width: tapZoneSize, height: tapZoneSize}},
        {name: 'left', style: {top: tapZoneSize, left: 0, width: tapZoneSize, height: tapZoneSize}}
    ];
    
    tapZones.forEach(zone => {
        const tapZone = document.createElement('div');
        tapZone.className = 'tap-zone';
        Object.assign(tapZone.style, {
            position: 'absolute',
            ...zone.style,
            opacity: 0.1,
            pointerEvents: 'auto'
        });
        
        tapZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!gameStarted && !isDemo) {
                startGame();
            }
            if (gameStarted && !isDemo) {
                handleButtonClick(zone.name);
                if (indicators[zone.name]) {
                    indicators[zone.name].classList.add('show');
                    setTimeout(() => {
                        indicators[zone.name].classList.remove('show');
                    }, 300);
                }
            }
        });
        
        mobileControls.appendChild(tapZone);
    });
    
    mobileControls.appendChild(swipeArea);
    gameplaySection.appendChild(mobileControls);
    console.log("Mobile controls created");
}

// Document loaded olayını güncelleyelim
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded");
    
    // Normal başlatma
    init();
});

// Mobil cihaz kontrolü
function checkMobileDevice() {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    
    if (isMobile) {
        console.log("Mobil cihaz algılandı, oyun içi kontroller aktif");
        document.querySelector('.in-game-controls')?.classList.add('active');
    } else {
        console.log("Masaüstü cihaz algılandı, normal kontroller aktif");
        document.querySelector('.in-game-controls')?.classList.remove('active');
    }
}

// Ekran boyutu değiştiğinde kontrol et
window.addEventListener('resize', checkMobileDevice);

// Separate function to set up event listeners
function setupEventListeners() {
    // Keyboard controls
    document.addEventListener('keydown', handleKeyDown);
    
    // Button controls
    const upBtn = document.getElementById('upBtn');
    const downBtn = document.getElementById('downBtn');
    const leftBtn = document.getElementById('leftBtn');
    const rightBtn = document.getElementById('rightBtn');
    
    // Add event listeners to all buttons
    if (upBtn && downBtn && leftBtn && rightBtn) {
        upBtn.addEventListener('click', () => handleButtonClick('up'));
        downBtn.addEventListener('click', () => handleButtonClick('down'));
        leftBtn.addEventListener('click', () => handleButtonClick('left'));
        rightBtn.addEventListener('click', () => handleButtonClick('right'));
        
        // Mobile touch events
        upBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleButtonClick('up');
        });
        downBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleButtonClick('down');
        });
        leftBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleButtonClick('left');
        });
        rightBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleButtonClick('right');
        });
    } else {
        console.error("Control buttons not found!");
    }
    
    // Other buttons
    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', resetGame);
    }
    
    if (demoButton) {
        demoButton.addEventListener('click', () => {
            if (isDemo) {
                stopDemo();
            } else {
                startDemo();
            }
        });
    }
    
    if (showLeaderboardBtn) {
        showLeaderboardBtn.addEventListener('click', () => {
            updateLeaderboard();
            leaderboardDiv.style.display = 'block';
        });
    }
    
    if (closeLeaderboardBtn) {
        closeLeaderboardBtn.addEventListener('click', () => {
            leaderboardDiv.style.display = 'none';
        });
    }
    
    if (submitButton) {
        submitButton.addEventListener('click', handleScoreSubmission);
    }
    
    // Modal outside click
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            resetGame();
        }
    });

    // Food guide
    const foodGuide = document.getElementById('foodGuide');
    const closeGuide = document.getElementById('closeGuide');

    // Add info button to controls section
    const infoBtn = document.createElement('button');
    infoBtn.id = 'infoBtn';
    infoBtn.className = 'game-btn';
    infoBtn.innerHTML = '<i class="fas fa-info-circle"></i> Guide';
    document.querySelector('.game-buttons').appendChild(infoBtn);

    // Toggle food guide
    infoBtn.addEventListener('click', () => {
        foodGuide.style.display = foodGuide.style.display === 'block' ? 'none' : 'block';
    });

    // Close guide button
    closeGuide.addEventListener('click', () => {
        foodGuide.style.display = 'none';
    });

    // Create direction arrows for all devices
    createDirectionArrows();
}

// Create direction arrows with semi-transparent indicators
function createDirectionArrows() {
    console.log("Creating direction arrows for mobile controls");
    const gameplaySection = document.querySelector('.gameplay-section');
    
    // Remove any existing direction arrows
    const existingArrows = document.querySelector('.direction-arrows');
    if (existingArrows) {
        existingArrows.remove();
    }
    
    // Create container for direction arrows
    const arrowsContainer = document.createElement('div');
    arrowsContainer.className = 'direction-arrows';
    
    // Create arrows for each direction
    const directions = ['up', 'right', 'down', 'left'];
    directions.forEach(direction => {
        const arrow = document.createElement('div');
        arrow.className = `direction-arrow ${direction}`;
        arrow.setAttribute('data-direction', direction);
        
        // Make sure there's no content in the div before the ::after pseudo-element
        arrow.innerHTML = '';
        
        // Add multiple event listeners for better responsiveness
        const handleTouch = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log(`${direction} arrow touched`);
            
            // First remove any existing feedback animations from all arrows
            directions.forEach(dir => {
                const dirArrow = arrowsContainer.querySelector(`.direction-arrow.${dir}`);
                if (dirArrow) {
                    dirArrow.classList.remove('feedback-active');
                }
            });
            
            // Then add the feedback animation class only to this arrow
            arrow.classList.add('feedback-active');
            
            // Execute the direction change
            handleArrowClick(direction);
            
            // Remove the animation class after it completes
            setTimeout(() => {
                arrow.classList.remove('feedback-active');
            }, 500);
        };
        
        // Add various touch event listeners for better handling
        arrow.addEventListener('touchstart', handleTouch, { passive: false });
        arrow.addEventListener('mousedown', handleTouch, { passive: false });
        arrow.addEventListener('click', handleTouch, { passive: false });
        
        arrowsContainer.appendChild(arrow);
    });
    
    // Add arrows container to gameplay section
    gameplaySection.appendChild(arrowsContainer);
    console.log("Direction arrows created with visual indicators");
}

// Improved arrow click handler
function handleArrowClick(direction) {
    console.log(`Arrow clicked: ${direction}`);
    
    if (isGameOver) {
        console.log("Game is over, ignoring arrow click");
        return;
    }
    
    // Start game if not started
    if (!gameStarted) {
        console.log("Starting game from arrow click");
        startGame();
    }
    
    // Update direction based on arrow clicked
    switch(direction) {
        case 'up':
            if (dy !== 1) { // Not moving down
                dx = 0;
                dy = -1;
                console.log("Direction changed to UP");
            } else {
                console.log("Cannot move UP while moving DOWN");
            }
            break;
        case 'right':
            if (dx !== -1) { // Not moving left
                dx = 1;
                dy = 0;
                console.log("Direction changed to RIGHT");
            } else {
                console.log("Cannot move RIGHT while moving LEFT");
            }
            break;
        case 'down':
            if (dy !== -1) { // Not moving up
                dx = 0;
                dy = 1;
                console.log("Direction changed to DOWN");
            } else {
                console.log("Cannot move DOWN while moving UP");
            }
            break;
        case 'left':
            if (dx !== 1) { // Not moving right
                dx = -1;
                dy = 0;
                console.log("Direction changed to LEFT");
            } else {
                console.log("Cannot move LEFT while moving RIGHT");
            }
            break;
    }
} 