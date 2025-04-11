const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const playAgainBtn = document.getElementById('playAgain');
const leaderboardDiv = document.getElementById('leaderboard');
const showLeaderboardBtn = document.getElementById('showLeaderboard');
const closeLeaderboardBtn = document.getElementById('closeLeaderboard');
const demoButton = document.getElementById('demoButton');

// Game settings
const gridSize = 20;
const tileCount = canvas.width / gridSize;
let snake = [{ x: 10, y: 10 }];
let food = { x: 5, y: 5 };
let dx = 0;
let dy = 0;
let score = 0;
let baseSpeed = 7;
let speed = baseSpeed;
let foodCount = 0;
let gameLoop = null;
let gameStarted = false;
let isDemo = false;
let demoTimeout;

// Touch handling
let touchStartX = 0;
let touchStartY = 0;

// Add these variables at the top with other game settings
const DEMO_MAX_STAGE = 10;
const DEMO_SAFE_DISTANCE = 2;

// Add these constants at the top
const API_BASE_URL = 'http://localhost:3000/api';
const GRID_DIRECTIONS = [
    { dx: 1, dy: 0 },   // right
    { dx: 0, dy: 1 },   // down
    { dx: -1, dy: 0 },  // left
    { dx: 0, dy: -1 }   // up
];

// Add these constants at the top with other game settings
const AI_STRATEGIES = {
    EARLY_GAME: 1,    // Direct pathfinding
    MID_GAME: 2,      // Safe pathfinding with space checking
    LATE_GAME: 3      // Hamiltonian cycle
};

// Add these event listeners after DOM elements are defined
const submitButton = document.getElementById('submitScore');
const nicknameInput = document.getElementById('nickname');
const modal = document.getElementById('nicknameModal');
const upBtn = document.getElementById('upBtn');
const downBtn = document.getElementById('downBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');

// Add these at the top with other game settings
let lastDirection = { dx: 0, dy: 0 }; // Track the last actual movement
let moveQueue = []; // Queue for buffering moves
const QUEUE_MAX_LENGTH = 2; // Maximum number of moves to buffer

// Add these constants at the top
const DEMO_MOVE_DELAY = 100;
const FOOD_WEIGHT = 1000;  // Increased priority for food

// Add premium features
const premiumFeatures = {
  themes: [
    { id: 'neon', price: 0.99, name: 'Neon Theme' },
    { id: 'retro', price: 0.99, name: 'Retro Theme' }
  ],
  powerups: [
    { id: 'slowmo', price: 1.99, name: 'Slow Motion' },
    { id: 'shield', price: 2.99, name: 'Shield' }
  ],
  removeAds: true,
  extraLevels: true,
  customThemes: true,
  multiplayerMode: true
};

// Demo için sabitler
const DEMO_MAX_LEVEL = 5;   // Demo maksimum seviye

function resizeCanvas() {
    const size = canvas.width;
    canvas.style.width = canvas.style.height = `${size}px`;
}

function randomFood() {
    // Add some margin to prevent food from appearing at edges
    const margin = 1;
    
    let newFood;
    do {
        newFood = {
            x: Math.floor(Math.random() * (tileCount - 2*margin)) + margin,
            y: Math.floor(Math.random() * (tileCount - 2*margin)) + margin
        };
    } while (snake.some(segment => segment.x === newFood.x && segment.y === newFood.y));
    
    food = newFood;
}

function checkCollision(head) {
    // Check self collision
    return snake.some((segment, index) => {
        if (index === 0) return false; // Skip head
        return segment.x === head.x && segment.y === head.y;
    });
}

function update() {
    if (!gameStarted) return;

    // Process the next move from the queue
    if (moveQueue.length > 0) {
        const nextMove = moveQueue[0];
        if (isValidNextMove(nextMove)) {
            dx = nextMove.dx;
            dy = nextMove.dy;
            lastDirection = { dx, dy };
        }
        moveQueue.shift(); // Remove the processed move
    }

    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    
    // Check wall collision
    if (head.x < 0) head.x = tileCount - 1;
    if (head.x >= tileCount) head.x = 0;
    if (head.y < 0) head.y = tileCount - 1;
    if (head.y >= tileCount) head.y = 0;

    // Check self collision
    if (checkCollision(head)) {
        gameOver();
        return;
    }

    snake.unshift(head);

    // Check food collision
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        foodCount++;
        
        if (foodCount % 10 === 0) {
            speed = baseSpeed + Math.floor(foodCount / 10) * 2;
            clearInterval(gameLoop);
            gameLoop = setInterval(update, 1000 / speed);
        }
        
        updateScoreDisplay();
        randomFood();
    } else {
        snake.pop();
    }

    draw();
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw gridlines (optional, helps with visibility)
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 0.5;
    
    // Draw snake
    ctx.fillStyle = '#00ff00';
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 10;
    snake.forEach((segment) => {
        ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 2, gridSize - 2);
    });

    // Draw food with enhanced visibility
    ctx.fillStyle = '#ff0000';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    const centerX = food.x * gridSize + gridSize/2;
    const centerY = food.y * gridSize + gridSize/2;
    const radius = gridSize/2 - 2;
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Reset shadow
    ctx.shadowBlur = 0;
}

function gameOver() {
    if (isDemo) {
        stopDemo();
        return;
    }
    
    clearInterval(gameLoop);
    gameLoop = null;
    gameStarted = false;
    document.body.classList.remove('game-active');
    
    const finalScore = document.getElementById('finalScore');
    finalScore.innerHTML = `
        <span class="score-text">Score: ${score}</span>
        <span class="level-text">Level ${Math.floor(foodCount / 10) + 1}</span>
    `;
    modal.style.display = 'block';
}

function resetGame() {
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
    document.body.classList.remove('game-active');
    updateScoreDisplay();
    playAgainBtn.style.display = 'none';
    modal.style.display = 'none';
    randomFood();
    draw();
}

function handleKeyDown(e) {
    if (!gameStarted && gameLoop === null && e.key.startsWith('Arrow')) {
        startGame();
    }

    if (!gameStarted) return;

    const newMove = getDirectionFromKey(e.key);
    if (newMove && isValidNextMove(newMove)) {
        addToMoveQueue(newMove);
    }
}

function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}

function handleTouchMove(e) {
    if (!gameStarted || gameLoop === null) return;

    if (!touchStartX || !touchStartY) return;

    const touchEndX = e.touches[0].clientX;
    const touchEndY = e.touches[0].clientY;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0 && dx !== -1) { dx = 1; dy = 0; }
        else if (deltaX < 0 && dx !== 1) { dx = -1; dy = 0; }
    } else {
        if (deltaY > 0 && dy !== -1) { dx = 0; dy = 1; }
        else if (deltaY < 0 && dy !== 1) { dx = 0; dy = -1; }
    }

    touchStartX = null;
    touchStartY = null;
}

function startGame() {
    if (!gameStarted) {
        gameStarted = true;
        document.body.classList.add('game-active');
        if (gameLoop) clearInterval(gameLoop);
        gameLoop = setInterval(update, 1000 / speed);
    }
}

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
                <span class="leaderboard-rank">#${index + 1} </span>
                <span class="leaderboard-name">${score.nickname} </span>
                <div class="score-info">
                    <span class="score-value">${score.score} </span>
                    <span class="score-stage">Stage ${score.stage} </span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error updating leaderboard:', error);
        const leaderboardList = document.getElementById('leaderboardList');
        leaderboardList.innerHTML = '<div class="leaderboard-item">Error loading scores</div>';
    }
}

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
            playAgainBtn.style.display = 'block';
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

// Update demo-related functions
function startDemo() {
    resetGame();
    isDemo = true;
    demoButton.innerHTML = '<i class="fas fa-stop"></i> Stop Demo';
    demoButton.classList.add('active');
    
    // Start from a strategic position
    snake = [{ x: 5, y: 5 }];
    dx = 1; // Başlangıçta sağa doğru hareket et
    dy = 0;
    gameStarted = true;
    speed = baseSpeed;
    
    // Game loop'u başlat
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(update, 1000 / speed);
    
    // Demo hareketi başlat
    setTimeout(runDemoMove, DEMO_MOVE_DELAY);
}

function stopDemo() {
    clearTimeout(demoTimeout);
    isDemo = false;
    demoButton.innerHTML = '<i class="fas fa-play"></i> Watch Demo';
    demoButton.classList.remove('active');
    resetGame();
}

function runDemoMove() {
    if (!isDemo) return;
    
    const head = snake[0];
    
    // Mevcut seviyeyi kontrol et
    const currentLevel = Math.floor(foodCount / 10) + 1;
    if (currentLevel > DEMO_MAX_LEVEL) {
        stopDemo();
        alert(`Demo tamamlandı! Seviye ${DEMO_MAX_LEVEL}'e ulaşıldı.`);
        return;
    }
    
    // En iyi hamleyi bul
    const nextMove = findBestMove(head);
    
    // Yönü güncelle
    dx = nextMove.dx;
    dy = nextMove.dy;
    
    // Sonraki hamle için planlama yap
    demoTimeout = setTimeout(runDemoMove, DEMO_MOVE_DELAY);
}

function findBestMove(head) {
    // Yemeğe olan mesafe
    const xDist = food.x - head.x;
    const yDist = food.y - head.y;
    
    // Olası hamleleri topla
    const possibleMoves = getPossibleMoves(head);
    
    // Eğer herhangi bir güvenli hamle yoksa, son çare olarak mevcut yönde devam et
    if (possibleMoves.length === 0) {
        return { dx, dy };
    }
    
    // Hareketleri yemeğe olan mesafeye göre sırala
    possibleMoves.sort((moveA, moveB) => {
        const nextPosA = {
            x: (head.x + moveA.dx + tileCount) % tileCount,
            y: (head.y + moveA.dy + tileCount) % tileCount
        };
        
        const nextPosB = {
            x: (head.x + moveB.dx + tileCount) % tileCount,
            y: (head.y + moveB.dy + tileCount) % tileCount
        };
        
        const distA = getManhattanDistance(nextPosA, food);
        const distB = getManhattanDistance(nextPosB, food);
        
        return distA - distB;
    });
    
    // Yemeğe yaklaşmayı ve güvenliği dengele
    for (const move of possibleMoves) {
        if (isSuperSafe(head, move)) {
            return move;
        }
    }
    
    // En güvenli hamleyi bulamadıysak, en azından çarpmayan bir hamle yapalım
    for (const move of possibleMoves) {
        if (isSafeMove(head, move)) {
            return move;
        }
    }
    
    // Son çare olarak ilk olası hamleyi dön
    return possibleMoves[0];
}

function getPossibleMoves(head) {
    return [
        { dx: 1, dy: 0 },   // sağ
        { dx: 0, dy: 1 },   // aşağı
        { dx: -1, dy: 0 },  // sol
        { dx: 0, dy: -1 }   // yukarı
    ].filter(move => {
        // Mevcut yönün tersi olamaz
        if ((move.dx === -dx && move.dy === -dy) && (dx !== 0 || dy !== 0)) {
            return false;
        }
        
        const nextPos = {
            x: (head.x + move.dx + tileCount) % tileCount,
            y: (head.y + move.dy + tileCount) % tileCount
        };
        
        return !wouldCollide(nextPos);
    });
}

function getManhattanDistance(pos1, pos2) {
    let dx = Math.abs(pos1.x - pos2.x);
    let dy = Math.abs(pos1.y - pos2.y);
    
    // Ekranın kenarlarından geçiş imkanını hesaba kat
    dx = Math.min(dx, tileCount - dx);
    dy = Math.min(dy, tileCount - dy);
    
    return dx + dy;
}

function isSuperSafe(head, move) {
    const nextPos = {
        x: (head.x + move.dx + tileCount) % tileCount,
        y: (head.y + move.dy + tileCount) % tileCount
    };
    
    // Çarpışma kontrolü
    if (wouldCollide(nextPos)) {
        return false;
    }
    
    // Kullanılabilir alanı hesapla
    const space = calculateAvailableSpace(nextPos);
    
    // Yılan uzunluğu + güvenlik payı kadar alan olmalı
    return space > snake.length * 1.5;
}

function isSafeMove(head, move) {
    const nextPos = {
        x: (head.x + move.dx + tileCount) % tileCount,
        y: (head.y + move.dy + tileCount) % tileCount
    };
    
    return !wouldCollide(nextPos);
}

function calculateAvailableSpace(startPos) {
    const visited = new Set();
    const queue = [startPos];
    let space = 0;
    
    while (queue.length > 0) {
        const current = queue.shift();
        const key = `${current.x},${current.y}`;
        
        if (visited.has(key)) continue;
        visited.add(key);
        space++;
        
        for (const dir of GRID_DIRECTIONS) {
            const newX = (current.x + dir.dx + tileCount) % tileCount;
            const newY = (current.y + dir.dy + tileCount) % tileCount;
            const newPos = { x: newX, y: newY };
            
            if (!wouldCollide(newPos) && !visited.has(`${newX},${newY}`)) {
                queue.push(newPos);
            }
        }
    }
    
    return space;
}

function wouldCollide(pos) {
    return snake.some(segment => 
        segment.x === pos.x && segment.y === pos.y
    );
}

// Update the button click handlers
function handleButtonClick(e) {
    // This will run on desktop
    const buttonId = e.currentTarget.id;
    
    // Don't need to repeat the logic as the original event listeners will handle it
    // This is just for visual feedback
    e.currentTarget.style.opacity = '0.7';
    setTimeout(() => {
        e.currentTarget.style.opacity = '1';
    }, 150);
}

// Add demo button event listener
demoButton.addEventListener('click', () => {
    if (isDemo) {
        stopDemo();
    } else {
        startDemo();
    }
});

// Update the init function
function init() {
    resizeCanvas();
    randomFood();
    draw();
    
    // Control button event listeners
    upBtn.addEventListener('click', () => handleButtonClick('up'));
    downBtn.addEventListener('click', () => handleButtonClick('down'));
    leftBtn.addEventListener('click', () => handleButtonClick('left'));
    rightBtn.addEventListener('click', () => handleButtonClick('right'));
    
    // Other event listeners
    submitButton.addEventListener('click', handleScoreSubmission);
    showLeaderboardBtn.addEventListener('click', () => {
        updateLeaderboard();
        leaderboardDiv.style.display = 'block';
    });
    closeLeaderboardBtn.addEventListener('click', () => {
        leaderboardDiv.style.display = 'none';
    });
    playAgainBtn.addEventListener('click', resetGame);
    
    // Keyboard controls
    document.addEventListener('keydown', handleKeyDown);
}

// Helper function to convert direction string to dx/dy
function getDirectionFromInput(direction) {
    switch (direction) {
        case 'up': return { dx: 0, dy: -1 };
        case 'down': return { dx: 0, dy: 1 };
        case 'left': return { dx: -1, dy: 0 };
        case 'right': return { dx: 1, dy: 0 };
        default: return null;
    }
}

// Helper function to convert key press to dx/dy
function getDirectionFromKey(key) {
    switch (key) {
        case 'ArrowUp': return { dx: 0, dy: -1 };
        case 'ArrowDown': return { dx: 0, dy: 1 };
        case 'ArrowLeft': return { dx: -1, dy: 0 };
        case 'ArrowRight': return { dx: 1, dy: 0 };
        default: return null;
    }
}

// Add to move queue if there's space
function addToMoveQueue(move) {
    if (moveQueue.length < QUEUE_MAX_LENGTH) {
        moveQueue.push(move);
    }
}

// Check if the new move is valid based on the last actual movement
function isValidNextMove(newMove) {
    if (!newMove) return false;
    
    // Get the direction to check against (either the last queued move or the current direction)
    const checkAgainst = moveQueue.length > 0 ? 
        moveQueue[moveQueue.length - 1] : 
        { dx, dy };

    // Can't move in opposite direction
    return !(
        (checkAgainst.dx === 1 && newMove.dx === -1) ||
        (checkAgainst.dx === -1 && newMove.dx === 1) ||
        (checkAgainst.dy === 1 && newMove.dy === -1) ||
        (checkAgainst.dy === -1 && newMove.dy === 1)
    );
}

// Update the score display function
function updateScoreDisplay() {
    const level = Math.floor(foodCount / 10) + 1;
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
}

// Add store UI
function createStoreUI() {
  const storeHTML = `
    <div id="store" class="modal">
      <div class="store-content">
        <h2>Store</h2>
        <div class="store-sections">
          <div class="themes-section">
            <h3>Themes</h3>
            ${premiumFeatures.themes.map(theme => `
              <div class="store-item">
                <span>${theme.name}</span>
                <button onclick="purchaseTheme('${theme.id}')">$${theme.price}</button>
              </div>
            `).join('')}
          </div>
          <div class="powerups-section">
            <h3>Power-ups</h3>
            ${premiumFeatures.powerups.map(powerup => `
              <div class="store-item">
                <span>${powerup.name}</span>
                <button onclick="purchasePowerup('${powerup.id}')">$${powerup.price}</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function upgradeToPremium() {
  // Implement payment processing
  stripe.redirectToCheckout({
    lineItems: [{
      price: 'price_premium_version',
      quantity: 1
    }],
    mode: 'payment',
    successUrl: window.location.origin + '/premium-success',
    cancelUrl: window.location.origin + '/premium-cancel',
  });
}

// Add these functions to improve button handling
function setupButtonListeners() {
    // Get all game buttons
    const gameButtons = document.querySelectorAll('.game-btn');
    
    // Add event listeners to each button
    gameButtons.forEach(button => {
        // Remove any existing listeners
        button.removeEventListener('touchstart', handleButtonTouch);
        button.removeEventListener('click', handleButtonClick);
        
        // Add touchstart listener for mobile
        button.addEventListener('touchstart', handleButtonTouch, { passive: false });
        
        // Add click listener for desktop
        button.addEventListener('click', handleButtonClick);
    });
}

function handleButtonTouch(e) {
    e.preventDefault(); // Prevent default touch behavior
    
    // Get button ID
    const buttonId = e.currentTarget.id;
    
    // Handle button action based on ID
    switch(buttonId) {
        case 'playAgain':
            resetGame();
            break;
        case 'demoButton':
            if (isDemo) {
                stopDemo();
            } else {
                startDemo();
            }
            break;
        case 'showLeaderboard':
            updateLeaderboard();
            leaderboardDiv.style.display = 'block';
            break;
    }
    
    // Add visual feedback
    e.currentTarget.style.opacity = '0.7';
    setTimeout(() => {
        e.currentTarget.style.opacity = '1';
    }, 150);
}

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', function() {
    setupButtonListeners();
    
    // Prevent unwanted page scrolling/zooming on touch devices
    document.addEventListener('touchmove', function(e) {
        if (e.target.classList.contains('game-btn') || e.target.classList.contains('control-btn')) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Setup original game
    resizeCanvas();
    randomFood();
    draw();
    updateLeaderboard();
}); 