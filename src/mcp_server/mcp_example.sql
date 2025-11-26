CREATE OR REPLACE FUNCTION public.mcp_example(
	ljinput jsonb)
    RETURNS jsonb
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
AS $BODY$

/*
@function public.mcp_example
@desc Example of MCP server for ChatGPT mini-app

@param string user_query - user's query
    
@return object|null result - object with success response
    @key string status - ok | error
@return object|null error - object with error data
    @key string|number code - error code
    @key string message - error message
    @key object details - error details
@return array|null proxy - array with tasks for proxy service

@version 0.2.1
#mcp #miniapp #example
*/
    
    
DECLARE
  
    -- Exception diagnostics
    lcExceptionContext          text;
    lcExceptionDetail           text;
    lcExceptionHint             text;
    lcExceptionMessage          text;
    lcExceptionState            text;

    -- Constants
    INITIAL_DATE                CONSTANT date := '2025-01-01'::date;                -- initial date to calculate date offset
    
    
    -- Input parameters
    ljRequest                   jsonb :=
        ljInput->'body';
    lcMethod                    text :=
        COALESCE(ljRequest->>'method', '');
    ljGPTParams                 jsonb :=
        ljRequest->'params';
    
    
    -- Local variables
    lnCurrentTime               bigint :=                                           -- current UNIX-timestamp in msec
        (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
    lnCurrentDate               integer :=                                          -- current date ID
        clock_timestamp()::date - INITIAL_DATE;
    
    ljMetaData                  jsonb;                                              -- OpenAI metadata
    
    lnUserID                    bigint;                                             -- User's ID
    lcUserQuery                 text;                                               -- User's query
    
    lcContext                   text;                                               -- Enriched context
    lcPictureURL                text;                                               -- Picture URL
    lcExternalURL               text;                                               -- External URL to open
    
    ljProxyTasks                jsonb;                                              -- proxy tasks
    ljResponse                  jsonb;                                              -- "body" response
    
    
BEGIN
    
    -- "initialize" method
    IF lcMethod = 'initialize' THEN
        
        ljResponse := jsonb_build_object(
            'id', ljRequest->'id',
            'jsonrpc', ljRequest->>'jsonrpc',
            'result', jsonb_build_object(
                'serverInfo', jsonb_build_object(
                    'version', '1.0.0',
                    'name', 'example-mcp',
                    'title', 'Demo MCP Server'
                ),
                'capabilities', jsonb_build_object(
                    'resources', jsonb_build_object('listChanged', false),
                    'tools', jsonb_build_object('listChanged', false),
                    'prompts', jsonb_build_object('listChanged', false),
                    'logging', jsonb_build_object()
                ),
                'scope', 'project',
                'modes', jsonb_build_array('chat'),
                'description', concat(
                    'An MCP connector that enriches user''s query with new context.'
                ),
                'protocolVersion', ljRequest->'params'->>'protocolVersion',
                'metadata', jsonb_build_object(
                    'author', 'Kone.vc',
                    'created_at', '2025-11-15T10:00:00Z'
                )
            )
        );
    
        
    
    
    -- Confirm the server initialization
    ELSEIF lcMethod = 'notifications/initialized' THEN
        
        ljResponse := jsonb_build_object(
            'id', ljRequest->'id',
            'jsonrpc', ljRequest->>'jsonrpc'
        );
        
        
    
    -- List of supported tools: search and fetch
    ELSEIF lcMethod = 'tools/list' THEN

        ljResponse := jsonb_build_object(
            'id', ljRequest->'id',
            'jsonrpc', ljRequest->>'jsonrpc',
            'result', jsonb_build_object(
                'tools', jsonb_build_array(
                    -- "get_enriched_context" tool
                    jsonb_build_object(
                        'name', 'get_enriched_context',
                        '_meta', jsonb_build_object(
                            'openai/outputTemplate', 'ui://widget/miniapp_example.html',
                            'openai/widgetAccessible', true
                        ),                        
                        'description', concat(
                            'This tool requests user''s query to prepare additional context for ChatGPT response. ',
                            'This tool responses with enriched context. ',
                            'ChatGPT **should use** this context in its response.'
                        ),
                        'inputSchema', jsonb_build_object(
                            'type', 'object',
                            'properties', jsonb_build_object(
                                'user_query', jsonb_build_object(
                                    'type', 'string',
                                    'description', 'User''s query to prepare the context.'
                                ),
                                'user_session_id', jsonb_build_object(
                                    'type', 'string',
                                    'description', 'Read "user_session_id" from the app local storage. Send empty string if not found.'
                                )
                            ),
                            'required', jsonb_build_array('user_query', 'user_session_id')
                        ),
                        'outputSchema', jsonb_build_object(
                            'type', 'object',
                            'properties', jsonb_build_object(
                                'context_for_chatgpt', jsonb_build_object(
                                    'type', 'string',
                                    'description', 'Enriched context for ChatGPT to use in its response.'
                                ),
                                'external_url', jsonb_build_object(
                                    'type', 'string',
                                    'description', 'External URL to open on the button click.'
                                ),
                                'picture_url', jsonb_build_object(
                                    'type', 'string',
                                    'description', 'Picture to display in mini app (desktop).'
                                ),
                                'mobile_picture_url', jsonb_build_object(
                                    'type', 'string',
                                    'description', 'Picture to display in mini app (smartphone).'
                                ),
                                'user_session_id', jsonb_build_object(
                                    'type', 'string',
                                    'description', 'User''s session ID to build a related context during the session.'
                                ),
                                'required', jsonb_build_array('context_for_chatgpt', 'external_url', 'picture_url', 'mobile_picture_url', 'user_session_id')
                            )
                        )
                    )
                )
            )
        );

        
    
    ELSEIF lcMethod = 'tools/call' THEN
    
        IF ljGPTParams->>'name' = 'get_enriched_context' THEN
            
            -- GPT metadata
            /*
                "openai/locale": "en-US",
                "openai/userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
                "openai/userLocation": {
                  "city": "London",
                  "country": "UK",
                  "timezone": "Europe/London"
                }
            */
            ljMetaData := ljRequest->'params'->'_meta';
            
            -- Read user's query
            lcUserQuery := ljRequest->'params'->'arguments'->>'user_query';
            
            
            -- Read user's ID (or generate a new one if empty)
            IF nullif(btrim(ljRequest->'params'->'arguments'->>'user_session_id'), '') IS NULL THEN
            
                lnUserID := RANDOM() * 281474976710655;
                
            ELSE 
            
                lnUserID := nullif(btrim(ljRequest->'params'->'arguments'->>'user_session_id'), '')::bigint;
                
            END IF;
            
            
            -- Enrich the context (prepare any custom business-logic here)
            lcContext := 'ChatGPT mini-apps allow you to create a customizable user interface on the fly based on user input. This is a great way to achieve hyper-personalization.';
            lcPictureURL := 'https://kone.vc/kone-vc.png';
            lcExternalURL := 'https://kone.vc';
            
            
            -- Build response
            ljResponse := jsonb_build_object(
                'id', ljRequest->'id',
                'jsonrpc', ljRequest->>'jsonrpc',
                'result', jsonb_build_object(
                    '_meta', jsonb_build_object(
                        'openai/outputTemplate', 'ui://widget/miniapp_example.html',
                        'openai/widgetAccessible', true,
                        'openai/resultCanProduceWidget', true,
                        'openai/toolInvocation/invoked', 'Ready',
                        'openai/toolInvocation/invoking', 'Preparing context...'
                    ),
                    'structuredContent', jsonb_build_object(
                        'external_url', lcExternalURL,
                        'picture_url', lcPictureURL,
                        'mobile_picture_url', lcPictureURL,
                        'context_for_chatgpt', lcContext,
                        'user_session_id', lnUserID::text
                    ),
                    'content', jsonb_build_array(
                        jsonb_build_object(
                            'type', 'text',
                            'text', jsonb_build_object(
                                'external_url', lcExternalURL,
                                'picture_url', lcPictureURL,
                                'mobile_picture_url', lcPictureURL,
                                'context_for_chatgpt', lcContext,
                                'user_session_id', lnUserID::text
                            )::text
                        )
                    )
                )
            );

        END IF;
    
    
            
            
    -- List of available resources
    ELSEIF lcMethod = 'resources/list' THEN

        ljResponse :=  jsonb_build_object(
            'id', ljRequest->'id',
            'jsonrpc', ljRequest->>'jsonrpc',
            'result', jsonb_build_object(
                'resources', jsonb_build_array(
                    jsonb_build_object(
                        'uri', 'ui://widget/miniapp_example.html',
                        'name', 'Miniapp Example',
                        'mimeType', 'text/html+skybridge',
                        'description', 'Find a relevant content and picture based on the user''s query'
                    )
                )
            )
        );
    
    
    
    -- List of available resource templates
    ELSEIF lcMethod = 'resources/templates/list' THEN
    
        ljResponse :=  jsonb_build_object(
            'id', ljRequest->'id',
            'jsonrpc', ljRequest->>'jsonrpc',
            'result', jsonb_build_object(
                'resourceTemplates', jsonb_build_array(
                    jsonb_build_object(
                        'uri', 'ui://widget/miniapp_example.html',
                        'name', 'Miniapp Example',
                        'mimeType', 'text/html+skybridge',
                        'description', 'Find a relevant content and picture based on the user''s query'
                    )
                )
            )
        );
    
    
    
    -- Read one of available resources
    ELSEIF lcMethod = 'resources/read' THEN

        ljResponse := jsonb_build_object(
            'id', ljRequest->'id',
            'jsonrpc', ljRequest->>'jsonrpc',
            'result', jsonb_build_object(
                'contents', jsonb_build_array(
                    jsonb_build_object(
                        'uri', 'ui://widget/miniapp_example.html',
                        'mimeType', 'text/html+skybridge',
                        'text', 
'
<!doctype html>
<html>
    <head>
        <meta charset="utf-8" />
        <link rel="stylesheet" href="https://dev.kone.vc/demo/main.css">
    </head>
    <body>
        <div id="chatgpt-app-root"></div>
        <script type="module" src="https://dev.kone.vc/demo/main.js"></script>
    </body>
</html>
',
                        '_meta', jsonb_build_object(
                            'openai/widgetCSP', jsonb_build_object(
                                'connect_domains', jsonb_build_array(),
                                'resource_domains', jsonb_build_array(
                                    'https://kone.vc',
                                    'https://dev.kone.vc'
                                )
                            ),
                            'openai/widgetDescription', 'Find a relevant content and picture based on the user''s query',
                            'openai/widgetPrefersBorder', true
                        )
                    )
                )
            )
        );
        
    
    -- unknown method
    ELSE
            
        ljResponse := jsonb_build_object('status', 'ok');
    
    END IF;
    
    
    
    -- Respond with "ok"
    RETURN jsonb_build_object(
        'body', ljResponse
    );

  
-- SQL error => exit with error code and details
EXCEPTION
    WHEN others THEN
        GET STACKED DIAGNOSTICS
            lcExceptionContext = PG_EXCEPTION_CONTEXT,
            lcExceptionDetail  = PG_EXCEPTION_DETAIL,
            lcExceptionHint    = PG_EXCEPTION_HINT,
            lcExceptionMessage = MESSAGE_TEXT,
            lcExceptionState   = RETURNED_SQLSTATE;
 
        RETURN jsonb_build_object(
            'error', jsonb_build_object(
                'code', 500,
                'message', 'Internal error',
                'details', jsonb_build_object(
                    'error_context', lcExceptionContext,
                    'error_detail',  lcExceptionDetail,
                    'error_hint',    lcExceptionHint,
                    'error_message', lcExceptionMessage,
                    'error_state',   lcExceptionState
                )
            )
        );
        
END;
$BODY$;

ALTER FUNCTION public.mcp_example(jsonb)
    OWNER TO unibackend;
