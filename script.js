// Import Amplify libraries
import Amplify from 'aws-amplify';
import { DataStore } from '@aws-amplify/datastore';
import { Marker } from './models'; // Assuming your marker model is defined in 'models.js'

Amplify.configure(awsconfig); // Replace 'awsconfig' with your actual Amplify configuration

const crawley = [51.11, -0.18];
const map = L.map('map').setView(crawley, 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(map);

L.circle(crawley, {
  color: 'blue',
  fillColor: 'blue',
  fillOpacity: 0.1,
  radius: 20 * 1609.34
}).addTo(map);

const addButton = document.getElementById('add-button');

// Load markers from DataStore
async function loadMarkers() {
  const markers = await DataStore.query(Marker);
  markers.forEach(markerData => {
    createMarker(markerData);
  });
  applyFilter();
}

loadMarkers(); // Load markers on page load

addButton.addEventListener('click', () => {
  const searchPopup = L.popup()
  .setLatLng(map.getCenter())
  .setContent('<input type="text" id="search-input" placeholder="Enter address"><button id="search-button">Search</button>')
  .openOn(map);

  const popupContent = searchPopup.getElement();

  popupContent.querySelector('#search-button').addEventListener('click', () => {
    const query = popupContent.querySelector('#search-input').value;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`)
    .then(response => response.json())
    .then(data => {
        if (data.length > 0) {
          const lat = parseFloat(data.lat);
          const lon = parseFloat(data.lon);
          map.setView([lat, lon], 15);
          showAddMarkerPopup(lat, lon, data);
        } else {
          alert('Location not found.');
        }
      })
    .catch(error => {
        console.error('Error fetching location:', error);
        alert('An error occurred while searching for the location.');
      });
  });
});

function showAddMarkerPopup(lat, lon, searchResult, existingMarker = null) {
  const existingData = existingMarker? existingMarker.getPopup().getContent().querySelector('.popup-content'): null;
  const companyName = existingData? existingData.querySelector('h3').textContent: '';
  const companyPurchase = existingData? existingData.querySelector('p:nth-of-type(1)').textContent.replace('Purchase: ', ''): '';
  const companySize = existingData? existingData.querySelector('p:nth-of-type(2)').textContent.replace('Size: ', ''): '';

  let selectedRepColorAdd = 'blue'; // Set default color

  if (existingMarker && existingMarker._icon) {
    selectedRepColorAdd = window.getComputedStyle(existingMarker._icon.querySelector('div')).backgroundColor;
    if (selectedRepColorAdd.startsWith('rgb')) {
      selectedRepColorAdd = rgbToHex(selectedRepColorAdd);
    }
  }

  const addMarkerPopup = L.popup()
  .setLatLng([lat, lon])
  .setContent(`<div>Company Name: <input type="text" id="company-name" value="${companyName}"><br>Purchase: <input type="text" id="company-purchase" value="${companyPurchase}"><br>Company Size: <input type="text" id="company-size" value="${companySize}"><br>Sales Rep: <select id="rep-dropdown-add"><option value="blue">Graeham Morrison</option><option value="red">Jamie Helyer</option><option value="green">Kieran Clark</option><option value="yellow">Tony Macklin</option><option value="purple">Abdoulaye Darbo</option><option value="orange">Other</option></select><br><button id="save-marker">Save</button></div>`)
  .openOn(map);

  const popupContent = addMarkerPopup.getElement();

  popupContent.querySelector('#rep-dropdown-add').value = selectedRepColorAdd;

  popupContent.querySelector('#save-marker').addEventListener('click', async () => {
    const newCompanyName = popupContent.querySelector('#company-name').value;
    const newCompanyPurchase = popupContent.querySelector('#company-purchase').value;
    const newCompanySize = popupContent.querySelector('#company-size').value;
    const newSelectedRepColorAdd = popupContent.querySelector('#rep-dropdown-add').value;

    if (existingMarker) {
      // Update existing marker
      existingMarker.setIcon(L.divIcon({
        className: `${newSelectedRepColorAdd}-marker`,
        iconSize:,
        iconAnchor:,
        popupAnchor: [1, -34],
        html: `<div style="background-color: ${newSelectedRepColorAdd}; height: 100%; width: 100%; border-radius: 50% 50% 50% 0;"></div>`
      }));
      existingMarker.setPopupContent(`<div class="marker-popup"><div class="popup-content"><h3>${newCompanyName}</h3><p>Purchase: ${newCompanyPurchase}</p><p>Size: ${newCompanySize}</p><p>Address: ${searchResult.display_name}</p></div><button class="edit-button">Edit</button></div>`);

      // Update marker in DataStore
      await DataStore.save(
        Marker.copyOf(existingMarker.amplifyMarker, updated => {
          updated.companyName = newCompanyName;
          updated.companyPurchase = newCompanyPurchase;
          updated.companySize = newCompanySize;
          updated.color = newSelectedRepColorAdd;
        })
      );

      addMarkerPopup.remove();
    } else {
      // Create new marker
      const marker = L.marker([lat, lon], {
        icon: L.divIcon({
          className: `${newSelectedRepColorAdd}-marker`,
          iconSize:,
          iconAnchor:,
          popupAnchor: [1, -34],
          html: `<div style="background-color: ${newSelectedRepColorAdd}; height: 100%; width: 100%; border-radius: 50% 50% 50% 0;"></div>`
        }),
        draggable: true
      }).addTo(map);

      // Create the popup content with the edit button
      const popupContent = document.createElement('div');
      popupContent.classList.add('marker-popup');
      popupContent.innerHTML = `<div class="popup-content"><h3>${newCompanyName}</h3><p>Purchase: ${newCompanyPurchase}</p><p>Size: ${newCompanySize}</p><p>Address: ${searchResult.display_name}</p></div><button class="edit-button">Edit</button>`;

      // Add event listener for the "Edit" button
      const editButton = popupContent.querySelector('.edit-button');
      editButton.addEventListener('click', () => {
        marker.closePopup();
        showAddMarkerPopup(marker.getLatLng().lat, marker.getLatLng().lng, searchResult, marker);
      });

      // Bind the popup content to the marker
      marker.bindPopup(popupContent);

      marker.on('mouseover', function() {
        this.openPopup();
      });

      // Add mouseleave event to the popup content
      popupContent.addEventListener('mouseleave', () => {
        marker.closePopup();
      });

      addMarkerPopup.remove();

      // Save marker to DataStore
      const newMarker = await DataStore.save(
        new Marker({
          lat: lat,
          lng: lon,
          companyName: newCompanyName,
          companyPurchase: newCompanyPurchase,
          companySize: newCompanySize,
          color: newSelectedRepColorAdd,
          address: searchResult.display_name
        })
      );

      // Store a reference to the Amplify Marker object in the Leaflet marker
      marker.amplifyMarker = newMarker;

      // Apply filter after the popup is closed
      marker.on("popupclose", applyFilter);
    }
  });
}

function rgbToHex(rgb) {
  rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  function hex(x) {
    return ("0" + parseInt(x).toString(16)).slice(-2);
  }
  return "#" + hex(rgb) + hex(rgb) + hex(rgb);
}

// Filter functionality
const filterCheckboxes = document.querySelectorAll('.key input[type="checkbox"]');
filterCheckboxes.forEach(checkbox => {
  checkbox.addEventListener('change', applyFilter);
});

function applyFilter() {
  const selectedReps =;
  filterCheckboxes.forEach(checkbox => {
    if (checkbox.checked) {
      selectedReps.push(checkbox.value);
    }
  });

  map.eachLayer(layer => {
    if (layer instanceof L.Marker) {
      const markerColor = rgbToHex(window.getComputedStyle(layer._icon.querySelector('div')).backgroundColor);
      const showMarker = selectedReps.includes(markerColor);

      if (showMarker) {
        if (!map.hasLayer(layer)) {
          map.addLayer(layer);
        }
      } else {
        // Only remove the marker if its popup is not open
        if (map.hasLayer(layer) &&!layer.isPopupOpen()) {
          map.removeLayer(layer);
        }
      }
    }
  });
}

// Function to create a marker with the given data
function createMarker(markerData) {
  const marker = L.marker([markerData.lat, markerData.lng], {
    icon: L.divIcon({
      className: `${markerData.color}-marker`,
      iconSize:,
      iconAnchor:,
      popupAnchor: [1, -34],
      html: `<div style="background-color: ${markerData.color}; height: 100%; width: 100%; border-radius: 50% 50% 50% 0;"></div>`
    }),
    draggable: true
  }).addTo(map)
  .bindPopup(`<div class="marker-popup"><div class="popup-content"><h3>${markerData.companyName}</h3><p>Purchase: ${markerData.companyPurchase}</p><p>Size: ${markerData.companySize}</p><p>Address: ${markerData.address}</p></div><button class="edit-button">Edit</button></div>`);

  // Store a reference to the Amplify Marker object in the Leaflet marker
  marker.amplifyMarker = markerData;

  marker.on('mouseover', function() {
    this.openPopup();
  });

  marker.on('popupopen', function() {
    const popupContent = this.getPopup().getElement();
    const editButton = popupContent.querySelector('.edit-button');
    editButton.addEventListener('click', () => {
      this.closePopup();
      showAddMarkerPopup(this.getLatLng().lat, this.getLatLng().lng, markerData, this); // Pass markerData instead of searchResult
    });

    popupContent.addEventListener('mouseleave', () => {
      this.closePopup();
    });
  });

  marker.on("popupclose", applyFilter);
}
