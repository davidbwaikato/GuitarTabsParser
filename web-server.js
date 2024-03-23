const fs      = require( "fs");
const path    = require( "path" );
const http    = require( "http" );

const index   = require( "./ugs/index" );
const scraper = require( "./scraper" );

function formatRequest( uri ) {
	uri = decodeURIComponent( uri );

	let output = { 
		url: uri 
	};

	if ( !/^\/.*\?/.test( uri ) ) {
		return "";
	}

	output.type = /^\/(.*)\?/.exec( uri )[1];
	output.args = {};
	let raw = uri.slice( uri.indexOf( output.type ) + output.type.length + 1, uri.length ).split( "&" );

	for ( let i in raw ) {
		let keyVal = raw[i].split( "=" );
		if ( keyVal.length == 2 ) {
			output.args[keyVal[0]] = keyVal[1];
		}
	}
	return output;
}

function sendFile(fileName, response)
{
    // default to index.html
    if ((fileName == "") || (fileName == "/")) {
	fileName = "/index.html";
    }
    
    const fullFilePath = path.join(__dirname,fileName);
    
    if (fs.existsSync(fullFilePath)) {
	var stat = fs.statSync(fullFilePath);

	response.writeHead( 200, {
            'Content-Length': stat.size
	}); 

	const data = fs.readFileSync(fullFilePath);

	response.write(data);
        response.end();
	console.log(`Sent file: ${fileName}`);	    
    }
    else {
        response.statusCode    = 404;
	response.statusMessage = `File not found: ${fileName}`;
	response.end();
	console.log(`HTML Header Status 404 - File not found: ${fullFilePath}`);
    }

}

function main(port) {

    console.log('----');
    console.log(`Starting web server on port: ${port}`);
    console.log('----');
    console.log(`To access the guitar tab serach page visit:`)
    console.log(`    http://0.0.0.0:${port}/index.html`)
    console.log('====\n');

    http.createServer( function( request, response ) {
	
	let formatted = formatRequest( request.url );
	
	if (formatted.type) {

	    response.setHeader('Access-Control-Allow-Origin', '*');
	    	    
	    if ( formatted.type.toLowerCase() === "autocomplete" ) {		
		if ( formatted.args.text ) {
		    index.autocomplete( formatted.args.text, function( a, b ) {
			console.log(`GuitarTabsParse.autocomplete() - text: ${formatted.args.text}`);
			//console.log(`GuitarTabsParse.autocomplete() - returned a=${a}, b=${b}`);
			
			if ( !a && b && b.length > 0 ) {
			    const b_str = JSON.stringify(b);
			
			    response.writeHead( 200, {
				'Content-Type': 'application/json',
				'Content-Length': b_str.length
			    }); 
			    response.write(b_str);
			}
			
			response.end();
		    } );
		} else {
		    response.write(`GuitarTabsParser Error - on autocomplete API call, failed to retrieve 'text' from returned UG data:`);
		    response.write( JSON.stringify(args) )		    
		    response.end();
		}
	    } else if ( formatted.type.toLowerCase() === "query" ) {
		if ( formatted.args.query ) {
		    formatted.args.type = "Tab"; // TODO make parser compatible with Chords types as well.
		    index.search( formatted.args, function( a, b ) {
			
			if ( !a && b ) {

			    if ( Array.isArray( b ) ) {
				console.log(`GuitarTabsParse.search() - found ${b.length} matches`);

				b = b.sort( function( elem1, elem2 ) {
				    return ( elem2.rating * elem2.numberRates ) - ( elem1.rating * elem1.numberRates );
				} );
			    }
			    else {
				console.log(`GuitarTabsParse.search() - found 1 match`);
			    }

			    const b_str = JSON.stringify(b);

			    response.writeHead( 200, {
				'Content-Type': 'application/json',
				'Content-Length': b_str.length
			    });			    
			    response.write(b_str);
			}
			else {
			    console.log(`GuitarTabsParse.search() - Unable to processed returned data: a=${a}, b=${b}`);
			}
			response.end();
		    });
		}
		else {
		    response.write(`GuitarTabsParser Error - On query API call, failed to retrieve 'query' from returned UG data:`);
		    response.write( JSON.stringify(args) )		    
		    response.end();
		}
	    } else if ( formatted.type.toLowerCase() === "parse" ) {
		let args = formatted.args;

		console.log(`GuitarTabsParse.parse() - args:`);
		console.log(args);
		
		if ( args && args.artist && args.song_identifier ) {
		    scraper.getSong( "https://tabs.ultimate-guitar.com/tab/" + args.artist + "/" + args.song_identifier, function( song ) {
			const parsed_tabs_str = JSON.stringify(song.parsed_tabs);
			
			response.writeHead( 200, {
			    'Content-Type': 'application/json',
			    'Content-Length': parsed_tabs_str.length
			});			    			
			response.write(parsed_tabs_str);
			response.end();
		    } );
		} else {
		    response.write(`GuitarTabsParser Error - On parse API call, failed to retrieve 'artist' and 'song_identifier' from UG returned data:`);
		    response.write( JSON.stringify(args) )
		    response.end();
		}
	    }
	    else {
		response.write(`GuitarTabsParser Error - Unrecognised API call type: ${formatted.type}`);
		console.log(`main() - unrecognised value for URL parameter 'type': '${formatted.type}'`);
		response.end();
	    }
	    
	}
	else {
	    // default to assuming the request is for a file
	    sendFile(request.url,response);
	    response.end();
	}

	//response.end();

  } ).listen( port );

}

// Running the web server default to port 8080 if environment variable PORT not set
main( process.env.PORT || 8080 );
