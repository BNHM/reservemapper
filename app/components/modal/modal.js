(function() {
	'use strict';

	angular.module('map.modal', ['map.query'])
		.factory('modal', modal)
		.factory('photoViewer', function() {
			return {
				clear: function(){
					document.getElementById("popupContent").innerHTML = ""
					return true;
				}
			};
		})


	modal.$inject = ['$rootScope', 'Map'];

	function modal(Map) {
		window.onload = function(){
			console.log( "ready!" );
		}

	//TODO: make this accessable to queryMap.service so clusterclickCallback can be called 
		function clusterclickCallback(m,resource){
			var popupContentElement = L.DomUtil.get("popupContent");
			var length = m.layer.getChildCount()
			var markerChildren = m.layer.getAllChildMarkers()

			for (var i = 0; i < length; i ++){
				popupContentElement.innerHTML += markerChildren[i].popupContentCallback
			}

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

			// The following code will display each marker element one at a time, after the user clicks a cluster
			//openModal()
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
		}

	}
	modal(Map)
})() 
