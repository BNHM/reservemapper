(function () {
	'use strict';

	angular.module('map.query')
		.factory('queryMap', queryMap)
        	.factory('photoViewer', function() {
			return {
     				clear: function(){
					document.getElementById("popupContent").innerHTML = ""
					return true;
     				}
  			};
        	});

	queryMap.$inject = ['Map'];

	function queryMap(Map) {
		
		var popupContent;
		function QueryMap(latColumn, lngColumn) {
			Map.call(this, latColumn, lngColumn);
		}


		QueryMap.prototype = Object.create(Map.prototype);

		QueryMap.prototype.setPhoto = function (photoOption) {
			this.photoOption = photoOption
			// NOTE: this is a hack.  Ran into trouble using popup boxes so ended up having to wrap the marker events
			// in a call to a div tag.  Then, ran into more troubles trying to pass scope of the close command into the
			// map.map module and having that effectively switch the showPopup variable to off, which lived inside another
			// module.  

		        this._clearMap();
			var modal = document.getElementById('photoModal')
			function openModal() {
			    modal.style.display = "block";
			}
			if (photoOption) {
				// TODO: Modify this by porting code from map.js
                   		this._clusterLayer.off('clusterclick')
                   		this._clusterLayer.on('clusterclick', function(m,resource){ alert('we a photo. put photo logic here from map.js') 
					
			var popupContentElement = L.DomUtil.get("popupContent");
			var length = m.layer.getChildCount()
			var markerChildren = m.layer.getAllChildMarkers()
			
			for (var i = 0; i < length; i ++){
				popupContentElement.innerHTML += markerChildren[i].popupContentCallback
			}
	
			// The following code will display each marker element one at a time, after the user clicks a cluster
			openModal()

			// prevNext element holds "showing results..." and prev next buttons
			var prevNext = document.createElement('div');
			prevNext.setAttribute('id','prevNext');
		
			// previous button
			var prev = document.createElement('a');
			prev.appendChild(document.createTextNode('Prev '))
			prev.setAttribute('id', 'prev')
			prevNext.appendChild(prev)
			// next button
			var next = document.createElement('a');
			next.appendChild(document.createTextNode('Next'))
			next.setAttribute('id','next')	
			prevNext.appendChild(next)
			//additional information for the user
			var text= document.createElement('div');
			text.setAttribute('id','text')	
			prevNext.appendChild(text)

			//add user controls into the popup information	
			popupContentElement.appendChild(prevNext)

			//retrieve each element to be displayed
			var elements = $("#popupContent").children(".photo");
			var length = elements.length;
			var counter = 0;
		   
			//Get direct children of popupContent div
			elements.each(function(e) {
				if (e != 0)
				$(this).hide();
			});
			
			//next button controller function
			$("#next").click(function(){
				// hide the current element
				elements.eq( counter ).hide()
				// if this is the last one, reset to 0
				if (counter == length -1) {
				    counter = 0;
				// increment counter in other cases
				} else {
				    counter++;
				}
				elements.eq( counter ).show()
				displayChange()
				return false;
			});

			//prev button controller function
			$("#prev").click(function(){
				// hide the current element
				elements.eq( counter ).hide()

				// if this is the first one, reset to 0
				if (counter == 0) {
				    counter = length -1;
				} else {
				    counter--;
				}
				elements.eq( counter ).show()
				displayChange()
				return false;
			});

			//populate additional information for the user
			function displayChange(){
				var shownElement = counter + 1
				text.innerHTML = ("Showing result "+ shownElement +" of "+ length)
			}
			displayChange()

			//retrieve the new popupContent information	
			var content = document.getElementById("popupContent")
			
			//add all information from popupContent into modal body
			document.getElementById("modal-body").appendChild(content)
			
			//retrieve close element by ID, on click (x) hide modal and hide popupContent
			document.getElementById("close").onclick = function() {
			    content.innerHTML = ""
			    modal.style.display = "none";
			}

			// When user clicks anywhere outside of modal, hide modal and popupContent
			window.onclick = function(event) {
			    if (event.target == modal) {
				modal.style.display = "none";
				content.innerHTML = ""
			    }
			}
				
				})
				popupContent = function (resource, classNum) {
					//push object containing new scientific name into observations array, if observations array is empty
					if (resource.observations[0] == undefined){
						resource.observations.push({scientific_name : 'undefined', url : 'unknown'})
					} 
					var retString = "<div class='photo " + classNum + "'>"
					retString += "<a href='" + resource.media_url+ "' target='_blank'><img src='" + resource.media_url + "'></a>";
					//if (resource.observations[0] != null)
					retString += "<ul>"	
					retString += "<br><strong><i>" + resource.observations[0].scientific_name + "</strong></i>" 
					retString += "<br><a href='" + resource.remote_resource + "' target='_blank'>Photo Courtesy of CalPhotos</a>" 
					retString += "<br>license: "+ resource.license 
					retString += "<br>photo taken on " + resource.begin_date 
					if (resource.authors )
						retString += "<br>by " + resource.authors 
					if (resource.locality)
						retString += "<br>at " + resource.locality
					retString += "</ul>"
					return retString;
				};
			} else {
                   	//	this._clusterLayer.off('clusterclick')
				// TODO: Modify this
                   		this._clusterLayer.on('clusterclick', function(a) {
					alert('we an occurrance, modify behaviour. e.g. zoom in once and re-clusterfy')
				})
				popupContent = function (resource) {
					return "<strong>institutionCode</strong>:  " + resource.institutionCode + "<br>" +
						"<strong>basisOfRecord</strong>:  " + resource.basisOfRecord + "<br>" +
						"<strong>eventDate</strong>:  " + resource.eventDate + "<br>" +
						"<strong>recordedBy</strong>:  " + resource.recordedBy + "<br>" +
						"<strong>ScientificName</strong>:  " + resource.scientificName + "<br>" +
						"<strong>Locality, Country</strong>:  " + resource.locality + ", " + resource.country + "<br>" +
						"<a href='http://www.gbif.org/occurrence/" + resource.key + "' target='_blank'>Occurrence details from GBIF site</a>";
				};
				}
		}

		QueryMap.prototype.setMarkers = function (data, zoomTo) {
			Map.prototype.setMarkers.call(this, data, popupContent, zoomTo);
		};

		QueryMap.prototype.addMarkers = function (data, zoomTo) {
			Map.prototype.addMarkers.call(this, data, popupContent, zoomTo);
		};

		return new QueryMap('decimalLatitude', 'decimalLongitude')
	}
})();
