// Show the loading message with initial count
function showLoadingMessage(totalCount) {
    const loadingDiv = document.getElementById('loadingMessage');
    loadingDiv.innerHTML = `Loading Records: <span id="loadedCount">0</span> / ${totalCount}`;
    loadingDiv.style.display = 'block';
}

// Update the count of loaded records
function updateLoadingCount(count) {
    const loadedCountEl = document.getElementById('loadedCount');
    if (loadedCountEl) {
        loadedCountEl.textContent = count;
    }
}

// Hide the loading message
function hideLoadingMessage() {
    document.getElementById('loadingMessage').style.display = 'none';
}

document.getElementById('toggleSidebarArrow').addEventListener('click', function () {
    const sidebar = document.getElementById('sidebar');
    const toggleArrow = document.getElementById('toggleSidebarArrow');

    // Toggle the collapsed class
    sidebar.classList.toggle('collapsed');
    toggleArrow.classList.toggle('collapsed');

    // Update the arrow direction
    toggleArrow.textContent = sidebar.classList.contains('collapsed') ? '→' : '←';

    // Use requestAnimationFrame for precise map resizing after transition
    setTimeout(() => {
        requestAnimationFrame(() => {
            map.invalidateSize(); // Force map to recalculate dimensions
        });
    }, 300); // Match this to the CSS transition duration (0.3s)
});



