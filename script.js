const pb = new PocketBase('https://api.vafmlaradio.fr');

let allMedia = [];
let currentTypeFilter = 'all';
let selectedFile = null;

// Récupération automatique du nom de l'utilisateur PocketBase connecté
function getAuthorName() {
    if (pb.authStore.isValid && pb.authStore.model) {
        return pb.authStore.model.name || pb.authStore.model.username || 'Membre VAFM';
    }
    return 'VAFM';
}

// Vérification de l'authentification au démarrage
function checkAuth() {
    const authScreen = document.getElementById('authScreen');
    const layoutMain = document.getElementById('layoutMain');
    const sidebar = document.getElementById('sidebar');

    if (pb.authStore.isValid) {
        if (authScreen) authScreen.style.display = 'none';
        if (layoutMain) layoutMain.style.display = 'flex';
        if (sidebar) sidebar.style.display = 'flex';
        loadMedia();
    } else {
        if (authScreen) authScreen.style.display = 'flex';
        if (layoutMain) layoutMain.style.display = 'none';
        if (sidebar) sidebar.style.display = 'none';
    }
}

// Connexion
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        await pb.collection('users').authWithPassword(email, password);
        showToast("Connexion réussie !");
        checkAuth();
    } catch (err) {
        showToast("Identifiants incorrects ou compte non autorisé.");
        console.error(err);
    }
}

// Déconnexion
function logout() {
    pb.authStore.clear();
    checkAuth();
    showToast("Déconnecté.");
}

// Chargement des médias
async function loadMedia() {
    try {
        const records = await pb.collection('photos').getList(1, 100, { 
            sort: '-created',
            expand: 'user'
        });
        allMedia = records.items;
        renderMedia();
    } catch (err) {
        showToast("Erreur d'accès aux données.");
        console.error(err);
    }
}

// Téléchargement direct du fichier
async function downloadMedia(url, filename) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'media-vafm';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(blobUrl);
        showToast("Téléchargement lancé !");
    } catch (err) {
        window.open(url, '_blank');
    }
}

// Rendu des médias
function renderMedia() {
    const grid = document.getElementById('mediaGrid');
    if (!grid) return;

    const searchVal = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const catVal = document.getElementById('categoryFilter')?.value || '';
    const sortVal = document.getElementById('sortOrder')?.value || 'desc';

    grid.innerHTML = '';

    let items = allMedia.filter(item => {
        const filename = item.image || '';
        const isVideo = (item.type && item.type.toLowerCase() === 'video') || !!filename.match(/\.(mp4|webm|mov|m4v)$/i);
        const isPhoto = (item.type && item.type.toLowerCase() === 'photo') || !isVideo;

        let matchType = true;
        if (currentTypeFilter === 'photo') matchType = isPhoto;
        if (currentTypeFilter === 'video') matchType = isVideo;

        const matchCat = !catVal || item.categorie === catVal;
        const matchSearch = !searchVal || 
            (item.titre && item.titre.toLowerCase().includes(searchVal)) || 
            (item.tags && item.tags.toLowerCase().includes(searchVal));

        return matchType && matchCat && matchSearch;
    });

    if (sortVal === 'asc') items.reverse();

    if (items.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 3rem 0; font-size: 0.9rem;">Aucun média trouvé.</p>`;
        return;
    }

    items.forEach(item => {
        const mediaUrl = pb.files.getUrl(item, item.image);
        const isVideo = (item.type && item.type.toLowerCase() === 'video') || !!item.image.match(/\.(mp4|webm|mov|m4v)$/i);
        const authorName = item.credit || item.expand?.user?.name || item.expand?.user?.username || getAuthorName();

        const card = document.createElement('div');
        card.className = 'media-card';
        card.innerHTML = `
            <div class="preview-wrapper">
                <span class="type-badge">${isVideo ? 'Vidéo' : 'Photo'}</span>
                ${isVideo 
                    ? `<video src="${mediaUrl}#t=0.1" preload="metadata" muted playsinline></video>`
                    : `<img src="${mediaUrl}" alt="${item.titre}" loading="lazy">`
                }
                <div class="preview-overlay">
                    <span class="zoom-icon">${isVideo ? '► Lire la vidéo' : 'Agrandir'}</span>
                </div>
            </div>
            
            <div class="media-info">
                <div class="media-header">
                    <h4 class="media-title" title="${item.titre}">${item.titre}</h4>
                    <span class="category-badge">${item.categorie || 'Général'}</span>
                </div>

                <div class="media-meta">
                    <span>Par : <strong>${authorName}</strong></span>
                </div>

                <div class="card-actions">
                    <button class="btn-card btn-download" title="Télécharger le fichier original">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Télécharger
                    </button>
                    <button class="btn-card btn-credit">
                        Crédit
                    </button>
                </div>
            </div>
        `;

        // Événement clic sur la miniature (ouverture lecteur/lightbox)
        const previewWrapper = card.querySelector('.preview-wrapper');
        previewWrapper.addEventListener('click', () => {
            openLightbox(mediaUrl, isVideo);
        });

        // Survol vidéo pour aperçu animé
        if (isVideo) {
            const videoEl = card.querySelector('video');
            if (videoEl) {
                previewWrapper.addEventListener('mouseenter', () => {
                    videoEl.play().catch(() => {});
                });
                previewWrapper.addEventListener('mouseleave', () => {
                    videoEl.pause();
                    videoEl.currentTime = 0;
                });
            }
        }

        // Bouton Télécharger
        const downloadBtn = card.querySelector('.btn-download');
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadMedia(mediaUrl, item.image);
        });

        // Bouton Crédit
        const creditBtn = card.querySelector('.btn-credit');
        creditBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(authorName, 'Auteur copié !');
        });

        grid.appendChild(card);
    });
}

// Drag and Drop & Modal Logic
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    const dropzone = document.getElementById('dropzone');
    if (!dropzone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });
});

function handleFileSelect(file) {
    if (!file) return;
    selectedFile = file;

    const isVideo = file.type.startsWith('video');
    const mediaTypeInput = document.getElementById('mediaType');
    if (mediaTypeInput) mediaTypeInput.value = isVideo ? 'video' : 'photo';

    const titleInput = document.getElementById('mediaTitle');
    if (titleInput && !titleInput.value) {
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        titleInput.value = nameWithoutExt.replace(/[-_]/g, ' ');
    }

    const dropContent = document.getElementById('dropzoneContent');
    const previewWrapper = document.getElementById('dropzonePreview');
    const previewContainer = document.getElementById('previewContainer');

    if (dropContent) dropContent.style.display = 'none';
    if (previewWrapper) previewWrapper.style.display = 'flex';

    const fileUrl = URL.createObjectURL(file);
    if (previewContainer) {
        previewContainer.innerHTML = isVideo 
            ? `<video src="${fileUrl}#t=0.1" muted playsinline controls style="max-height:160px; width:100%; object-fit:cover;"></video>` 
            : `<img src="${fileUrl}" alt="Preview">`;
    }

    const fileNameEl = document.getElementById('fileName');
    const fileSizeEl = document.getElementById('fileSize');
    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
}

function resetFileSelection(e) {
    if (e) e.stopPropagation();
    selectedFile = null;
    const fileInput = document.getElementById('mediaFile');
    if (fileInput) fileInput.value = '';
    
    const dropContent = document.getElementById('dropzoneContent');
    const previewWrapper = document.getElementById('dropzonePreview');
    const previewContainer = document.getElementById('previewContainer');

    if (dropContent) dropContent.style.display = 'flex';
    if (previewWrapper) previewWrapper.style.display = 'none';
    if (previewContainer) previewContainer.innerHTML = '';
}

function closeUploadModal() {
    toggleModal('uploadModal', false);
    resetFileSelection();
    const form = document.getElementById('uploadForm');
    if (form) form.reset();
}

// Envoi d'un nouveau fichier
async function handleUpload(e) {
    e.preventDefault();
    const fileInput = document.getElementById('mediaFile');
    const fileToUpload = selectedFile || (fileInput ? fileInput.files[0] : null);

    if (!fileToUpload) {
        showToast("Veuillez choisir un fichier.");
        return;
    }

    const formData = new FormData();
    formData.append('image', fileToUpload);
    formData.append('titre', document.getElementById('mediaTitle')?.value || fileToUpload.name);
    formData.append('type', document.getElementById('mediaType')?.value || (fileToUpload.type.startsWith('video/') ? 'video' : 'photo'));
    formData.append('categorie', document.getElementById('mediaCategory')?.value || 'Général');
    formData.append('tags', document.getElementById('mediaTags')?.value || '');
    
    formData.append('credit', getAuthorName());
    if (pb.authStore.model?.id) {
        formData.append('user', pb.authStore.model.id);
    }

    try {
        await pb.collection('photos').create(formData);
        showToast("Fichier publié sur le Drive !");
        closeUploadModal();
        loadMedia();
    } catch (err) {
        console.error("Détails d'erreur PocketBase :", err?.response);
        const msg = err?.response?.message || "Erreur lors de l'envoi";
        showToast(`Erreur : ${msg}`);
    }
}

function openLightbox(url, isVideo) {
    const container = document.getElementById('lightboxBody');
    if (container) {
        container.innerHTML = isVideo 
            ? `<video id="lightboxVideo" src="${url}" controls autoPlay playsinline style="max-width:90vw; max-height:80vh; border-radius:8px;"></video>`
            : `<img src="${url}" style="max-width:90vw; max-height:80vh; border-radius:8px;">`;
    }
    toggleModal('lightboxModal', true);
}

function closeLightbox() {
    const container = document.getElementById('lightboxBody');
    if (container) {
        // Stopper proprement toutes les vidéos dans la lightbox avant de vider le DOM
        const videos = container.querySelectorAll('video');
        videos.forEach(video => {
            video.pause();
            video.removeAttribute('src');
            video.load();
        });
        container.innerHTML = '';
    }
    toggleModal('lightboxModal', false);
}

function toggleModal(id, show) {
    const modal = document.getElementById(id);
    if (!modal) return;
    
    modal.classList.toggle('active', show);

    if (id === 'lightboxModal' && !show) {
        closeLightbox();
    }
}

function setTab(btn, type) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTypeFilter = type;
    renderMedia();
}

function toggleModal(id, show) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.toggle('active', show);
}

function copyToClipboard(text, msg) {
    navigator.clipboard.writeText(text);
    showToast(msg);
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2800);
}